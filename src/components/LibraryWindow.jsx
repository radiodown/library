import { useState } from 'react'
import SaveStatusBar from './SaveStatusBar'
import BookList from './BookList'
import BookDetail from './BookDetail'
import BookForm from './BookForm'
import PixelIcon from './PixelIcon'
import MenuBar from './MenuBar'

/** "서재" 창의 내용: DB 파일 관리 툴바 + 책 목록/상세/감상문. */
export default function LibraryWindow({
  isReady,
  isDirty,
  busy,
  error,
  lastSaved,
  canAutoSave,
  driveSupported,
  books,
  fsaSupported,
  openLibrary,
  saveLibrary,
  addOrUpdateBook,
  removeBook,
  listReviews,
  removeReview,
  readings,
  saveReading,
  removeReading,
  quotes,
  saveQuote,
  removeQuote,
  onOpenReviewWindow,
  onViewReview,
  onSearchBy,
  onOpenWindow, // (name) => void — 보기/도움말 메뉴에서 다른 창을 엽니다
  onCloseWindow,
  focus,
}) {
  const [selectedBookId, setSelectedBookId] = useState(focus?.bookId ?? null)
  const [bookFormMode, setBookFormMode] = useState(null) // null | 'new' | book object
  const [seenNonce, setSeenNonce] = useState(focus?.nonce)

  // 검색/랭킹 창에서 "이 책 보기"를 누르면 이미 열려 있는 서재 창도 그 책으로 이동합니다. (렌더 중 상태 갱신 패턴)
  if (focus?.nonce !== seenNonce) {
    setSeenNonce(focus?.nonce)
    setSelectedBookId(focus?.bookId ?? null)
    setBookFormMode(null)
  }

  const selectedBook = books.find((b) => b.id === selectedBookId) || null
  // App이 reviewsVersion 변경으로 다시 렌더링될 때마다 이 값도 최신 DB 상태로 새로 계산됩니다.
  // (다른 창에서 감상문을 저장/삭제해도 반영되는 이유)
  const reviews = selectedBook ? listReviews(selectedBook.id) : []
  const bookReadings = selectedBook ? readings.filter((r) => r.bookId === selectedBook.id) : []
  const bookQuotes = selectedBook ? quotes.filter((q) => q.bookId === selectedBook.id) : []

  const handleSaveBookForm = (book) => {
    const id = addOrUpdateBook(book)
    setBookFormMode(null)
    setSelectedBookId(id)
  }

  const handleDeleteBook = () => {
    if (!selectedBook) return
    if (!window.confirm(`"${selectedBook.title}"을(를) 휴지통으로 보낼까요? 감상문, 회차, 인용구도 함께 옮겨지며 휴지통에서 복원할 수 있습니다.`)) return
    removeBook(selectedBook.id)
    setSelectedBookId(null)
  }

  const menus = [
    {
      label: '파일(F)',
      items: [
        { label: '서재 파일 열기...', onClick: openLibrary, disabled: busy },
        { label: '저장', onClick: () => saveLibrary(false), shortcut: 'Ctrl+S', disabled: busy || !isReady },
        { label: '다른 이름으로 저장...', onClick: () => saveLibrary(true), shortcut: 'Ctrl+Shift+S', disabled: busy || !isReady },
        { separator: true },
        { label: '닫기', onClick: () => onCloseWindow() },
      ],
    },
    {
      label: '편집(E)',
      items: [
        { label: '책 추가...', onClick: () => setBookFormMode('new'), disabled: !isReady },
        { label: '책 정보 수정...', onClick: () => setBookFormMode(selectedBook), disabled: !selectedBook },
        { label: '휴지통으로 보내기', onClick: handleDeleteBook, disabled: !selectedBook },
        { separator: true },
        { label: '감상문 쓰기...', onClick: () => onOpenReviewWindow(selectedBook, null), disabled: !selectedBook },
      ],
    },
    {
      label: '보기(V)',
      items: [
        { label: '검색', onClick: () => onOpenWindow('search'), disabled: !isReady },
        { label: '다음 책', onClick: () => onOpenWindow('next-books'), disabled: !isReady },
        { label: '독서 통계', onClick: () => onOpenWindow('stats'), disabled: !isReady },
        { label: '오늘의 인용구', onClick: () => onOpenWindow('quote') },
        { separator: true },
        { label: '휴지통', onClick: () => onOpenWindow('trash'), disabled: !isReady },
      ],
    },
    {
      label: '도움말(H)',
      items: [{ label: '서재 속성', onClick: () => onOpenWindow('properties') }],
    },
  ]

  return (
    <div className="library-window">
      <MenuBar menus={menus} />
      {error && (
        <p className="app__error">
          <PixelIcon name="warning" className="pixel-icon--inline" />
          {error}
        </p>
      )}

      <div className="construction-bar" role="presentation" />

      {!isReady && (
        <div className="app__empty-state">
          <p>서재 DB 파일(.db)을 열거나, 새 서재를 만들어 시작하세요.</p>
          <button type="button" onClick={openLibrary} disabled={busy}>
            서재 파일 열기
          </button>
          <p className="app__empty-state-sub">Best viewed with any modern browser · No plugins required</p>
        </div>
      )}

      {isReady && (
        <main className="app__main">
          <BookList
            books={books}
            selectedBookId={selectedBookId}
            onSelectBook={(id) => {
              setSelectedBookId(id)
              setBookFormMode(null)
            }}
            onAddBook={() => setBookFormMode('new')}
          />

          <section className="app__detail">
            {bookFormMode === 'new' && (
              <BookForm
                books={books}
                onSave={handleSaveBookForm}
                onCancel={() => setBookFormMode(null)}
              />
            )}

            {bookFormMode && bookFormMode !== 'new' && (
              <BookForm
                book={bookFormMode}
                books={books}
                onSave={handleSaveBookForm}
                onCancel={() => setBookFormMode(null)}
              />
            )}

            {!bookFormMode && selectedBook && (
              <BookDetail
                book={selectedBook}
                reviews={reviews}
                readings={bookReadings}
                quotes={bookQuotes}
                saveReading={saveReading}
                removeReading={removeReading}
                saveQuote={saveQuote}
                removeQuote={removeQuote}
                addOrUpdateBook={addOrUpdateBook}
                removeReview={removeReview}
                onAddReview={() => onOpenReviewWindow(selectedBook, null)}
                onEditReview={(review) => onOpenReviewWindow(selectedBook, review)}
                onViewReview={(review) => onViewReview(selectedBook, review)}
                onEditBook={() => setBookFormMode(selectedBook)}
                onDeleteBook={handleDeleteBook}
                onSearchBy={onSearchBy}
              />
            )}

            {!bookFormMode && !selectedBook && (
              <div className="app__placeholder">왼쪽에서 책을 선택하거나 새로 추가하세요.</div>
            )}
          </section>
        </main>
      )}

      <SaveStatusBar
        isReady={isReady}
        isDirty={isDirty}
        lastSaved={lastSaved}
        canAutoSave={canAutoSave}
        driveSupported={driveSupported}
        fsaSupported={fsaSupported}
      />
    </div>
  )
}
