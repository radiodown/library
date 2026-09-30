import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createNewDatabase,
  loadDatabaseFromBuffer,
  exportDatabase,
  getBooks,
  upsertBook,
  deleteBook,
  getTrashedBooks,
  trashBook,
  restoreBook as restoreBookRow,
  emptyTrash as emptyTrashRows,
  getReviewsForBook,
  getAllReviews,
  upsertReview,
  deleteReview,
  getReviewCounts as queryReviewCounts,
  getNextBookIds,
  setNextBookIds,
  getReadings,
  upsertReading,
  deleteReading,
  getQuotes,
  upsertQuote,
  deleteQuote,
} from '../db/sqlite'
import { openDbFile, saveDbFile, isFileSystemAccessSupported } from '../db/fileIO'
import { downloadFromDrive, uploadToDrive, isDriveConfigured } from '../db/googleDrive'
import { saveLastLibrary, loadLastLibrary } from '../db/lastLibrary'

const UNSAVED_LABEL = '새 서재 (아직 저장 안 됨)'
const AUTOSAVE_INTERVAL_MS = 60_000

/**
 * 서재 DB의 전체 생명주기(생성/열기/저장)와 책·감상문 CRUD를 관리하는 훅.
 * rememberLast: 연 서재의 사본을 브라우저에 보관해 다음에 바로 불러올 수 있게 합니다. (모바일용)
 */
export function useLibraryDb({ rememberLast = false } = {}) {
  const dbRef = useRef(null)
  const fileHandleRef = useRef(null)
  const driveFileIdRef = useRef(null)
  // 저장 대상: 'file'(내 PC 파일) | 'drive'(Google Drive) | null(아직 정해지지 않음)
  const targetRef = useRef(null)
  // 변경할 때마다 증가하는 번호. 저장하는 동안(await 중) 생긴 변경을 "저장됨"으로 잘못 표시하지 않기 위함.
  const revisionRef = useRef(0)
  const savedRevisionRef = useRef(0)
  const savingRef = useRef(false)

  const [books, setBooks] = useState([])
  const [nextBookIds, setNextBookIdsState] = useState([]) // 맨 앞이 가장 먼저 읽을 책
  const [trashedBooks, setTrashedBooks] = useState([]) // 휴지통에 있는 책
  const [readings, setReadings] = useState([]) // 모든 책의 다시 읽기(2회차~)
  const [quotes, setQuotes] = useState([]) // 모든 책의 인용구
  const [fileName, setFileName] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [lastSaved, setLastSaved] = useState(null) // { at: Date, auto: boolean }
  const [canAutoSave, setCanAutoSave] = useState(false) // 저장 대상(파일 핸들 또는 Drive)이 정해졌을 때만 가능
  const [saveTarget, setSaveTargetState] = useState(null) // 'file' | 'drive' | null
  const [driveStatus, setDriveStatus] = useState(null) // { phase: 'working'|'done'|'error', text }
  const [lastLibrary, setLastLibrary] = useState(null) // { name, savedAt } 브라우저에 보관된 사본
  // 감상문이 다른 창(floating window)에서 저장/삭제될 수 있으므로, 값 자체보다
  // "바뀌었다"는 신호가 필요한 컴포넌트(예: BookDetail)가 다시 렌더링되도록 매번 증가시킵니다.
  const [reviewsVersion, setReviewsVersion] = useState(0)

  const setTarget = useCallback((target) => {
    targetRef.current = target
    setSaveTargetState(target)
    setCanAutoSave(target !== null)
  }, [])

  // Drive 작업(불러오기/저장)의 진행·완료·실패를 사용자에게 보여 주기 위한 상태로 감쌉니다.
  const withDriveStatus = useCallback(async (working, done, fn) => {
    setDriveStatus({ phase: 'working', text: working })
    try {
      await fn()
      setDriveStatus({ phase: 'done', text: done })
    } catch (err) {
      if (err?.name === 'AbortError') setDriveStatus(null)
      else setDriveStatus({ phase: 'error', text: err?.message || String(err) })
      throw err
    }
  }, [])

  const dismissDriveStatus = useCallback(() => setDriveStatus(null), [])

  const markDirty = useCallback(() => {
    revisionRef.current += 1
    setIsDirty(true)
  }, [])

  // 책이 바뀌면 딸린 데이터(랭킹·회차·인용구)도 함께 바뀔 수 있으므로 한꺼번에 다시 읽습니다.
  const refreshAll = useCallback(() => {
    if (!dbRef.current) return
    setBooks(getBooks(dbRef.current))
    setTrashedBooks(getTrashedBooks(dbRef.current))
    setNextBookIdsState(getNextBookIds(dbRef.current))
    setReadings(getReadings(dbRef.current))
    setQuotes(getQuotes(dbRef.current))
  }, [])

  const runGuarded = useCallback(async (fn) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      // 사용자가 파일 선택 다이얼로그를 취소한 경우도 여기로 들어오므로 조용히 무시
      if (err?.name !== 'AbortError') {
        console.error(err)
        setError(err?.message || String(err))
      }
    } finally {
      setBusy(false)
    }
  }, [])

  const newLibrary = useCallback(
    () =>
      runGuarded(async () => {
        dbRef.current = await createNewDatabase()
        fileHandleRef.current = null
        driveFileIdRef.current = null
        setTarget(null)
        setFileName(UNSAVED_LABEL)
        markDirty()
        setIsReady(true)
        refreshAll()
      }),
    [runGuarded, refreshAll, setTarget],
  )

  const openLibrary = useCallback(
    () =>
      runGuarded(async () => {
        const { buffer, handle, name } = await openDbFile()
        dbRef.current = await loadDatabaseFromBuffer(buffer)
        if (rememberLast) saveLastLibrary(name, new Uint8Array(buffer)).then((info) => info && setLastLibrary(info))
        fileHandleRef.current = handle
        driveFileIdRef.current = null
        setTarget(handle ? 'file' : null)
        setFileName(name)
        savedRevisionRef.current = revisionRef.current
        setIsDirty(false)
        setIsReady(true)
        refreshAll()
      }),
    [runGuarded, refreshAll, rememberLast, setTarget],
  )

  // Google Drive에 올려 둔 서재를 내려받아 엽니다.
  const openFromDrive = useCallback(
    () =>
      runGuarded(async () => {
        let result
        await withDriveStatus('Google Drive에서 불러오는 중...', 'Google Drive에서 불러왔습니다.', async () => {
          result = await downloadFromDrive()
          if (!result) throw new Error('Google Drive에 저장된 서재가 없습니다. 먼저 서재를 열고 "Drive에 저장"을 눌러 주세요.')
        })
        dbRef.current = await loadDatabaseFromBuffer(result.buffer)
        if (rememberLast) saveLastLibrary(result.name, new Uint8Array(result.buffer)).then((info) => info && setLastLibrary(info))
        fileHandleRef.current = null
        driveFileIdRef.current = result.fileId
        setTarget('drive')
        setFileName(`${result.name} (Google Drive)`)
        savedRevisionRef.current = revisionRef.current
        setIsDirty(false)
        setIsReady(true)
        refreshAll()
      }),
    [runGuarded, refreshAll, rememberLast, setTarget, withDriveStatus],
  )

  // 브라우저에 보관된 마지막 서재 사본을 엽니다. (파일 핸들이 없으므로 저장은 다운로드가 됩니다)
  const restoreLastLibrary = useCallback(
    () =>
      runGuarded(async () => {
        const last = await loadLastLibrary()
        if (!last) throw new Error('보관된 서재가 없습니다. "서재 파일 열기"로 불러와 주세요.')
        dbRef.current = await loadDatabaseFromBuffer(last.bytes)
        fileHandleRef.current = null
        driveFileIdRef.current = null
        setTarget(null)
        setFileName(last.name)
        savedRevisionRef.current = revisionRef.current
        setIsDirty(false)
        setIsReady(true)
        refreshAll()
      }),
    [runGuarded, refreshAll, setTarget],
  )

  // 앱을 열면 보관된 사본이 있는지 확인해 "마지막 서재 불러오기" 버튼에 쓸 정보를 준비합니다.
  useEffect(() => {
    if (!rememberLast) return
    loadLastLibrary().then((last) => last && setLastLibrary({ name: last.name, savedAt: last.savedAt }))
  }, [rememberLast])

  // 실제 저장. 수동 저장과 자동 저장이 함께 쓰며, 동시에 두 번 돌지 않게 막습니다.
  // destination: 'current'(지금 대상) | 'as'(다른 이름으로, 내 PC) | 'drive'(Google Drive)
  const persist = useCallback(
    async (destination = 'current', auto = false) => {
      const db = dbRef.current
      if (!db || savingRef.current) return
      savingRef.current = true
      try {
        const revision = revisionRef.current
        const bytes = exportDatabase(db)
        const toDrive = destination === 'drive' || (destination === 'current' && targetRef.current === 'drive')

        // 변경 없이 같은 대상에 다시 저장하려는 경우(저장 버튼 연타 등)는 건너뜁니다.
        // 저장 대상을 바꾸는 "다른 이름으로 저장"과, 대상이 아직 없을 때의 첫 저장은 그대로 진행합니다.
        const sameTarget = destination === 'current' ? !!targetRef.current : destination === 'drive' && targetRef.current === 'drive'
        if (!auto && sameTarget && revision === savedRevisionRef.current) {
          if (toDrive) setDriveStatus({ phase: 'done', text: '변경사항이 없어 저장하지 않았습니다.' })
          return
        }

        if (toDrive) {
          const upload = () => uploadToDrive(bytes, driveFileIdRef.current, { interactive: !auto })
          // 자동 저장은 조용히, 수동 저장만 상태창을 띄웁니다.
          let fileId
          if (auto) fileId = await upload()
          else await withDriveStatus('Google Drive에 저장하는 중...', 'Google Drive에 저장했습니다.', async () => { fileId = await upload() })
          driveFileIdRef.current = fileId
          fileHandleRef.current = null
          setTarget('drive')
          setFileName('library.db (Google Drive)')
        } else {
          const handle = destination === 'as' ? null : fileHandleRef.current
          const suggested = fileName && fileName !== UNSAVED_LABEL && targetRef.current === 'file' ? fileName : 'library.db'
          const resultHandle = await saveDbFile(bytes, handle, suggested)
          if (resultHandle) {
            fileHandleRef.current = resultHandle
            driveFileIdRef.current = null
            setTarget('file')
            setFileName(resultHandle.name)
          }
        }
        savedRevisionRef.current = revision
        setIsDirty(revisionRef.current !== revision) // 저장 중에 생긴 변경은 미저장으로 남김
        setLastSaved({ at: new Date(), auto, drive: toDrive })
      } finally {
        savingRef.current = false
      }
    },
    [fileName, setTarget, withDriveStatus],
  )

  const saveLibrary = useCallback(
    (saveAs = false) => runGuarded(() => persist(saveAs ? 'as' : 'current')),
    [runGuarded, persist],
  )

  const saveToDrive = useCallback(() => runGuarded(() => persist('drive')), [runGuarded, persist])

  // 자동 저장(파일/Drive 공통): 저장 대상이 정해져 있고 저장하지 않은 변경이 있을 때만 조용히 저장합니다.
  // (대상이 없으면 저장 다이얼로그/다운로드가 매번 뜨게 되므로 하지 않습니다.)
  const autoSave = useCallback(async () => {
    if (!targetRef.current || !dbRef.current || savingRef.current) return
    if (revisionRef.current === savedRevisionRef.current) return
    try {
      await persist('current', true)
      setError((e) => (e?.startsWith('자동 저장 실패') ? null : e))
    } catch (err) {
      console.error(err)
      setError(`자동 저장 실패: ${err?.message || err}`)
    }
  }, [persist])

  // 타이머가 다시 만들어지지 않도록 최신 autoSave를 ref로 들고 있습니다.
  const autoSaveRef = useRef(autoSave)
  useEffect(() => {
    autoSaveRef.current = autoSave
  })
  useEffect(() => {
    if (!isReady) return undefined
    const timer = setInterval(() => autoSaveRef.current(), AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [isReady])

  const addOrUpdateBook = useCallback(
    (book) => {
      if (!dbRef.current) return null
      const id = upsertBook(dbRef.current, book)
      markDirty()
      refreshAll()
      return id
    },
    [refreshAll],
  )

  // 책 삭제는 완전히 지우지 않고 휴지통으로 보냅니다. 복원하면 감상문/회차/인용구도 그대로 돌아옵니다.
  const removeBook = useCallback(
    (id) => {
      if (!dbRef.current) return
      trashBook(dbRef.current, id)
      markDirty()
      refreshAll()
    },
    [refreshAll],
  )

  const restoreBook = useCallback(
    (id) => {
      if (!dbRef.current) return
      restoreBookRow(dbRef.current, id)
      markDirty()
      refreshAll()
    },
    [refreshAll],
  )

  // 휴지통에서 한 권을 영구 삭제
  const purgeBook = useCallback(
    (id) => {
      if (!dbRef.current) return
      deleteBook(dbRef.current, id)
      markDirty()
      refreshAll()
    },
    [refreshAll],
  )

  const emptyTrash = useCallback(() => {
    if (!dbRef.current) return
    emptyTrashRows(dbRef.current)
    markDirty()
    refreshAll()
  }, [refreshAll])

  const saveNextBooks = useCallback((bookIds) => {
    if (!dbRef.current) return
    setNextBookIds(dbRef.current, bookIds)
    markDirty()
    setNextBookIdsState(bookIds)
  }, [])

  const saveReading = useCallback(
    (reading) => {
      if (!dbRef.current) return null
      const id = upsertReading(dbRef.current, reading)
      markDirty()
      setReadings(getReadings(dbRef.current))
      return id
    },
    [],
  )

  const removeReading = useCallback((id) => {
    if (!dbRef.current) return
    deleteReading(dbRef.current, id)
    markDirty()
    setReadings(getReadings(dbRef.current))
  }, [])

  const saveQuote = useCallback((quote) => {
    if (!dbRef.current) return null
    const id = upsertQuote(dbRef.current, quote)
    markDirty()
    setQuotes(getQuotes(dbRef.current))
    return id
  }, [])

  const removeQuote = useCallback((id) => {
    if (!dbRef.current) return
    deleteQuote(dbRef.current, id)
    markDirty()
    setQuotes(getQuotes(dbRef.current))
  }, [])

  const listReviews = useCallback((bookId) => {
    if (!dbRef.current) return []
    return getReviewsForBook(dbRef.current, bookId)
  }, [])

  const listAllReviews = useCallback(() => {
    if (!dbRef.current) return []
    return getAllReviews(dbRef.current)
  }, [])

  const getReviewCounts = useCallback(() => {
    if (!dbRef.current) return {}
    return queryReviewCounts(dbRef.current)
  }, [])

  const saveReview = useCallback((review) => {
    if (!dbRef.current) return null
    const id = upsertReview(dbRef.current, review)
    markDirty()
    setReviewsVersion((v) => v + 1)
    return id
  }, [])

  const removeReview = useCallback((id) => {
    if (!dbRef.current) return
    deleteReview(dbRef.current, id)
    markDirty()
    setReviewsVersion((v) => v + 1)
  }, [])

  return {
    isReady,
    isDirty,
    busy,
    error,
    fileName,
    lastSaved,
    canAutoSave,
    saveTarget,
    driveSupported: isDriveConfigured(),
    openFromDrive,
    saveToDrive,
    driveStatus,
    dismissDriveStatus,
    lastLibrary,
    restoreLastLibrary,
    books,
    trashedBooks,
    restoreBook,
    purgeBook,
    emptyTrash,
    nextBookIds,
    saveNextBooks,
    readings,
    saveReading,
    removeReading,
    quotes,
    saveQuote,
    removeQuote,
    fsaSupported: isFileSystemAccessSupported(),
    newLibrary,
    openLibrary,
    saveLibrary,
    addOrUpdateBook,
    removeBook,
    listReviews,
    listAllReviews,
    getReviewCounts,
    saveReview,
    removeReview,
    reviewsVersion,
  }
}
