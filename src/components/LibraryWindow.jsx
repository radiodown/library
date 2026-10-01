import { useCallback, useEffect, useRef, useState } from 'react'
import AutoSaveNotice from './AutoSaveNotice'
import BookList from './BookList'
import BookDetail from './BookDetail'
import BookForm from './BookForm'
import PixelIcon from './PixelIcon'
import MenuBar from './MenuBar'
import Toolbar from './Toolbar'
import ContextMenu from './ContextMenu'
import { useDialog } from './dialogContext'
import { getProgressAction } from '../utils/bookProgress'
import { todayString } from '../utils/stats'

// 이 폭보다 좁은 창에서는 목록과 책 정보를 위아래로 놓습니다.
const NARROW_WIDTH = 620

// 보기 > 도구 모음 켜기/끄기는 브라우저에 기억해 둡니다.
const TOOLBAR_KEY = 'library98-toolbar-hidden'

function readToolbarVisible() {
  try {
    return localStorage.getItem(TOOLBAR_KEY) !== '1'
  } catch {
    return true
  }
}

/**
 * "서재" 창의 내용: 메뉴 + 도구 모음 + 책 목록/상세/감상문.
 * 책에 대한 명령(읽기 시작, 회차/인용구/감상문 추가, 수정, 삭제)은 도구 모음, 편집 메뉴,
 * 책 우클릭 메뉴 세 곳에서 똑같이 쓸 수 있고, 책을 선택했을 때만 활성화됩니다.
 */
export default function LibraryWindow({
  isReady,
  busy,
  error,
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
  // 회차/인용구 "추가"는 책 정보 안의 해당 섹션이 입력 칸을 펼치도록 요청 번호를 넘깁니다.
  const [addRequest, setAddRequest] = useState(null) // { kind: 'reading'|'quote', bookId, nonce }

  // 검색/랭킹 창에서 "이 책 보기"를 누르면 이미 열려 있는 서재 창도 그 책으로 이동합니다. (렌더 중 상태 갱신 패턴)
  if (focus?.nonce !== seenNonce) {
    setSeenNonce(focus?.nonce)
    setSelectedBookId(focus?.bookId ?? null)
    setBookFormMode(null)
    setAddRequest(null)
  }

  const selectedBook = books.find((b) => b.id === selectedBookId) || null
  const selectBook = (id) => {
    if (id !== selectedBookId) setAddRequest(null) // 그 책으로 돌아왔을 때 지난 "추가"가 다시 열리지 않게
    setSelectedBookId(id)
    setBookFormMode(null)
  }

  // 창 폭이 좁으면 목록과 책 정보를 위아래로 배치합니다. (CSS 컨테이너 쿼리는 오래된 브라우저에서 안 돼서 직접 잽니다)
  const rootRef = useRef(null)
  const [narrow, setNarrow] = useState(false)

  const [toolbarVisible, setToolbarVisible] = useState(readToolbarVisible)
  const toggleToolbar = () => {
    const next = !toolbarVisible
    setToolbarVisible(next)
    try {
      if (next) localStorage.removeItem(TOOLBAR_KEY)
      else localStorage.setItem(TOOLBAR_KEY, '1')
    } catch {
      // 저장소를 못 써도 이번에는 바뀐 대로 보입니다.
    }
  }
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < NARROW_WIDTH))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 오른쪽 칸은 따로 스크롤되므로, 다른 책을 고르거나 폼을 열고 닫으면 맨 위부터 보여 줍니다.
  const detailRef = useRef(null)
  useEffect(() => {
    if (detailRef.current) detailRef.current.scrollTop = 0
  }, [selectedBookId, bookFormMode])
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

  const requestCountRef = useRef(0) // 같은 추가를 연달아 눌러도 매번 새 요청이 되도록 늘려 가는 번호
  const requestAdd = (kind, book) => {
    setBookFormMode(null)
    requestCountRef.current += 1
    setAddRequest({ kind, bookId: book.id, nonce: requestCountRef.current })
  }
  // 폼을 열면 책 정보가 사라졌다가 다시 그려지므로, 지난 요청이 다시 실행되지 않게 지웁니다.
  const openBookForm = (mode) => {
    setAddRequest(null)
    setBookFormMode(mode)
  }

  const dialog = useDialog()

  const handleDeleteBook = async (book) => {
    const ok = await dialog.confirm(
      `"${book.title}"을(를) 휴지통으로 보낼까요? 감상문, 회차, 인용구도 함께 옮겨지며 휴지통에서 복원할 수 있습니다.`,
      { title: '휴지통으로 보내기', okLabel: '휴지통으로' },
    )
    if (!ok) return
    removeBook(book.id)
    if (book.id === selectedBookId) setSelectedBookId(null)
  }

  // 책 하나에 대한 명령들. 책이 없으면(선택 안 함) 모두 비활성입니다.
  const bookCommands = (book) => {
    const progress = book
      ? getProgressAction({
          book,
          readings: readings.filter((r) => r.bookId === book.id),
          today: todayString(),
          saveReading,
          addOrUpdateBook,
        })
      : { label: '읽기 시작', icon: 'book-read', run: () => {} }
    const disabled = !book
    return {
      progress: { ...progress, onClick: progress.run, disabled, title: `${progress.label} (오늘 날짜로 기록됩니다)` },
      reading: { label: '회차 추가', icon: 'calendar', onClick: () => requestAdd('reading', book), disabled, title: '다시 읽은 회차를 날짜와 함께 기록합니다' },
      quote: { label: '인용구', icon: 'quote', onClick: () => requestAdd('quote', book), disabled, title: '인용구 추가' },
      review: { label: '감상문', icon: 'notepad', onClick: () => onOpenReviewWindow(book, null), disabled, title: '감상문 쓰기' },
      edit: { label: '정보 수정', icon: 'pencil', onClick: () => openBookForm(book), disabled, title: '책 정보 수정' },
      remove: { label: '삭제', icon: 'trash-lid', onClick: () => handleDeleteBook(book), disabled, title: '휴지통으로 보내기' },
    }
  }
  const cmd = bookCommands(selectedBook)
  const addBook = { label: '책 추가', icon: 'document-new', onClick: () => openBookForm('new'), disabled: !isReady }

  const toolbarItems = [
    addBook,
    { separator: true },
    cmd.progress,
    cmd.reading,
    cmd.quote,
    cmd.review,
    { separator: true },
    cmd.edit,
    cmd.remove,
  ]

  // 메뉴(편집 메뉴, 우클릭 메뉴)용 항목: 입력 칸이나 창이 열리는 항목은 "..."을 붙입니다 (98식)
  const menuItemsFor = (c) => [
    { label: c.progress.label, onClick: c.progress.onClick, disabled: c.progress.disabled },
    { label: '회차 추가...', onClick: c.reading.onClick, disabled: c.reading.disabled },
    { label: '인용구 추가...', onClick: c.quote.onClick, disabled: c.quote.disabled },
    { label: '감상문 쓰기...', onClick: c.review.onClick, disabled: c.review.disabled },
    { separator: true },
    { label: '책 정보 수정...', onClick: c.edit.onClick, disabled: c.edit.disabled },
    { label: '휴지통으로 보내기', onClick: c.remove.onClick, disabled: c.remove.disabled },
  ]

  const [contextMenu, setContextMenu] = useState(null) // { x, y, items }
  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  // 책을 오른쪽 클릭하면 그 책을 선택하고 메뉴를 띄웁니다. (Windows 탐색기처럼)
  const handleBookContextMenu = (book, e) => {
    selectBook(book.id)
    setContextMenu({ x: e.clientX, y: e.clientY, items: menuItemsFor(bookCommands(book)) })
  }
  const handleListContextMenu = (e) =>
    setContextMenu({ x: e.clientX, y: e.clientY, items: [{ label: '책 추가...', onClick: addBook.onClick }] })

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
        { label: '책 추가...', onClick: addBook.onClick, disabled: addBook.disabled },
        { separator: true },
        ...menuItemsFor(cmd),
      ],
    },
    {
      label: '보기(V)',
      items: [
        { label: '도구 모음', onClick: toggleToolbar, checked: toolbarVisible },
        { separator: true },
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
    <div className={`library-window${narrow ? ' is-narrow' : ''}`} ref={rootRef}>
      <MenuBar menus={menus} />
      {toolbarVisible && <Toolbar items={toolbarItems} label="서재 도구 모음" />}
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
            onSelectBook={selectBook}
            onBookContextMenu={handleBookContextMenu}
            onListContextMenu={handleListContextMenu}
          />

          <section className="app__detail" ref={detailRef}>
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
                key={selectedBook.id} // 책이 바뀌면 열려 있던 회차/인용구 입력 칸을 닫고 새로 그립니다
                book={selectedBook}
                reviews={reviews}
                readings={bookReadings}
                quotes={bookQuotes}
                saveReading={saveReading}
                removeReading={removeReading}
                saveQuote={saveQuote}
                removeQuote={removeQuote}
                removeReview={removeReview}
                onEditReview={(review) => onOpenReviewWindow(selectedBook, review)}
                onViewReview={(review) => onViewReview(selectedBook, review)}
                onSearchBy={onSearchBy}
                addRequest={addRequest}
              />
            )}

            {!bookFormMode && !selectedBook && (
              <div className="app__placeholder">
                왼쪽에서 책을 선택하거나, 도구 모음의 "책 추가"로 새 책을 넣으세요.
              </div>
            )}
          </section>
        </main>
      )}

      <AutoSaveNotice fsaSupported={fsaSupported} />

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={closeContextMenu} />
      )}
    </div>
  )
}
