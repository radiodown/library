import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createNewDatabase,
  loadDatabaseFromBuffer,
  exportDatabase,
  getBooks,
  upsertBook,
  deleteBook,
  getReviewsForBook,
  upsertReview,
  deleteReview,
  getReviewCounts as queryReviewCounts,
  getRankingIds,
  setRankingIds,
  getReadings,
  upsertReading,
  deleteReading,
  getQuotes,
  upsertQuote,
  deleteQuote,
} from '../db/sqlite'
import { openDbFile, saveDbFile, isFileSystemAccessSupported } from '../db/fileIO'

const UNSAVED_LABEL = '새 서재 (아직 저장 안 됨)'
const AUTOSAVE_INTERVAL_MS = 60_000

/** 서재 DB의 전체 생명주기(생성/열기/저장)와 책·감상문 CRUD를 관리하는 훅. */
export function useLibraryDb() {
  const dbRef = useRef(null)
  const fileHandleRef = useRef(null)
  // 변경할 때마다 증가하는 번호. 저장하는 동안(await 중) 생긴 변경을 "저장됨"으로 잘못 표시하지 않기 위함.
  const revisionRef = useRef(0)
  const savedRevisionRef = useRef(0)
  const savingRef = useRef(false)

  const [books, setBooks] = useState([])
  const [rankingIds, setRankingIdsState] = useState([]) // 1위가 맨 앞
  const [readings, setReadings] = useState([]) // 모든 책의 다시 읽기(2회차~)
  const [quotes, setQuotes] = useState([]) // 모든 책의 인용구
  const [fileName, setFileName] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [lastSaved, setLastSaved] = useState(null) // { at: Date, auto: boolean }
  const [canAutoSave, setCanAutoSave] = useState(false) // 덮어쓸 파일 핸들이 있을 때만 가능
  // 감상문이 다른 창(floating window)에서 저장/삭제될 수 있으므로, 값 자체보다
  // "바뀌었다"는 신호가 필요한 컴포넌트(예: BookDetail)가 다시 렌더링되도록 매번 증가시킵니다.
  const [reviewsVersion, setReviewsVersion] = useState(0)

  const markDirty = useCallback(() => {
    revisionRef.current += 1
    setIsDirty(true)
  }, [])

  // 책이 바뀌면 딸린 데이터(랭킹·회차·인용구)도 함께 바뀔 수 있으므로 한꺼번에 다시 읽습니다.
  const refreshAll = useCallback(() => {
    if (!dbRef.current) return
    setBooks(getBooks(dbRef.current))
    setRankingIdsState(getRankingIds(dbRef.current))
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
        setCanAutoSave(false)
        setFileName(UNSAVED_LABEL)
        markDirty()
        setIsReady(true)
        refreshAll()
      }),
    [runGuarded, refreshAll],
  )

  const openLibrary = useCallback(
    () =>
      runGuarded(async () => {
        const { buffer, handle, name } = await openDbFile()
        dbRef.current = await loadDatabaseFromBuffer(buffer)
        fileHandleRef.current = handle
        setCanAutoSave(!!handle)
        setFileName(name)
        savedRevisionRef.current = revisionRef.current
        setIsDirty(false)
        setIsReady(true)
        refreshAll()
      }),
    [runGuarded, refreshAll],
  )

  // 실제 저장. 수동 저장과 자동 저장이 함께 쓰며, 동시에 두 번 돌지 않게 막습니다.
  const persist = useCallback(
    async (saveAs, auto = false) => {
      const db = dbRef.current
      if (!db || savingRef.current) return
      savingRef.current = true
      try {
        const revision = revisionRef.current
        const bytes = exportDatabase(db)
        const handle = saveAs ? null : fileHandleRef.current
        const suggested = fileName && fileName !== UNSAVED_LABEL ? fileName : 'library.db'
        const resultHandle = await saveDbFile(bytes, handle, suggested)
        if (resultHandle) {
          fileHandleRef.current = resultHandle
          setFileName(resultHandle.name)
        }
        savedRevisionRef.current = revision
        setIsDirty(revisionRef.current !== revision) // 저장 중에 생긴 변경은 미저장으로 남김
        setCanAutoSave(!!fileHandleRef.current)
        setLastSaved({ at: new Date(), auto })
      } finally {
        savingRef.current = false
      }
    },
    [fileName],
  )

  const saveLibrary = useCallback(
    (saveAs = false) => runGuarded(() => persist(saveAs)),
    [runGuarded, persist],
  )

  // 자동 저장: 덮어쓸 파일이 정해져 있고 저장하지 않은 변경이 있을 때만 조용히 저장합니다.
  // (파일이 없으면 저장 다이얼로그/다운로드가 매번 뜨게 되므로 하지 않습니다.)
  const autoSave = useCallback(async () => {
    if (!fileHandleRef.current || !dbRef.current || savingRef.current) return
    if (revisionRef.current === savedRevisionRef.current) return
    try {
      await persist(false, true)
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

  const removeBook = useCallback(
    (id) => {
      if (!dbRef.current) return
      deleteBook(dbRef.current, id)
      markDirty()
      refreshAll()
    },
    [refreshAll],
  )

  const saveRanking = useCallback((bookIds) => {
    if (!dbRef.current) return
    setRankingIds(dbRef.current, bookIds)
    markDirty()
    setRankingIdsState(bookIds)
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
    books,
    rankingIds,
    saveRanking,
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
    getReviewCounts,
    saveReview,
    removeReview,
    reviewsVersion,
  }
}
