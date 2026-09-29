import { useCallback, useRef, useState } from 'react'
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
} from '../db/sqlite'
import { openDbFile, saveDbFile, isFileSystemAccessSupported } from '../db/fileIO'

const UNSAVED_LABEL = '새 서재 (아직 저장 안 됨)'

/** 서재 DB의 전체 생명주기(생성/열기/저장)와 책·감상문 CRUD를 관리하는 훅. */
export function useLibraryDb() {
  const dbRef = useRef(null)
  const fileHandleRef = useRef(null)

  const [books, setBooks] = useState([])
  const [fileName, setFileName] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // 감상문이 다른 창(floating window)에서 저장/삭제될 수 있으므로, 값 자체보다
  // "바뀌었다"는 신호가 필요한 컴포넌트(예: BookDetail)가 다시 렌더링되도록 매번 증가시킵니다.
  const [reviewsVersion, setReviewsVersion] = useState(0)

  const refreshBooks = useCallback(() => {
    if (!dbRef.current) return
    setBooks(getBooks(dbRef.current))
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
        setFileName(UNSAVED_LABEL)
        setIsDirty(true)
        setIsReady(true)
        refreshBooks()
      }),
    [runGuarded, refreshBooks],
  )

  const openLibrary = useCallback(
    () =>
      runGuarded(async () => {
        const { buffer, handle, name } = await openDbFile()
        dbRef.current = await loadDatabaseFromBuffer(buffer)
        fileHandleRef.current = handle
        setFileName(name)
        setIsDirty(false)
        setIsReady(true)
        refreshBooks()
      }),
    [runGuarded, refreshBooks],
  )

  const saveLibrary = useCallback(
    (saveAs = false) =>
      runGuarded(async () => {
        if (!dbRef.current) return
        const bytes = exportDatabase(dbRef.current)
        const handle = saveAs ? null : fileHandleRef.current
        const suggested = fileName && fileName !== UNSAVED_LABEL ? fileName : 'library.db'
        const resultHandle = await saveDbFile(bytes, handle, suggested)
        if (resultHandle) {
          fileHandleRef.current = resultHandle
          setFileName(resultHandle.name)
        }
        setIsDirty(false)
      }),
    [runGuarded, fileName],
  )

  const addOrUpdateBook = useCallback(
    (book) => {
      if (!dbRef.current) return null
      const id = upsertBook(dbRef.current, book)
      setIsDirty(true)
      refreshBooks()
      return id
    },
    [refreshBooks],
  )

  const removeBook = useCallback(
    (id) => {
      if (!dbRef.current) return
      deleteBook(dbRef.current, id)
      setIsDirty(true)
      refreshBooks()
    },
    [refreshBooks],
  )

  const listReviews = useCallback((bookId) => {
    if (!dbRef.current) return []
    return getReviewsForBook(dbRef.current, bookId)
  }, [])

  const saveReview = useCallback((review) => {
    if (!dbRef.current) return null
    const id = upsertReview(dbRef.current, review)
    setIsDirty(true)
    setReviewsVersion((v) => v + 1)
    return id
  }, [])

  const removeReview = useCallback((id) => {
    if (!dbRef.current) return
    deleteReview(dbRef.current, id)
    setIsDirty(true)
    setReviewsVersion((v) => v + 1)
  }, [])

  return {
    isReady,
    isDirty,
    busy,
    error,
    fileName,
    books,
    fsaSupported: isFileSystemAccessSupported(),
    newLibrary,
    openLibrary,
    saveLibrary,
    addOrUpdateBook,
    removeBook,
    listReviews,
    saveReview,
    removeReview,
    reviewsVersion,
  }
}
