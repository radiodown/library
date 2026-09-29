import { useEffect, useRef, useState } from 'react'
import BookList from './BookList'
import BookDetail from './BookDetail'

/**
 * 모바일 "서재" 창의 내용(읽기 전용). 창 안에서 책 목록 ↔ 책 상세를 오갑니다.
 * 감상문은 데스크탑처럼 "보기"를 누르면 별도의 전체 화면 창으로 열려서, 작업표시줄로 여러 개를 오갈 수 있습니다.
 * focus: { bookId, nonce } — 랭킹/인용구 창에서 "이 책 보기"를 누르면 다른 책으로 이동시키는 신호입니다.
 */
export default function MobileLibrary({ books, readings, quotes, listReviews, focus, onViewReview }) {
  const [selectedId, setSelectedId] = useState(focus?.bookId ?? null)
  const [seenNonce, setSeenNonce] = useState(focus?.nonce)
  const rootRef = useRef(null)
  const listScrollRef = useRef(0)

  // 이미 열려 있는 창에 새 focus 요청이 오면 그 책으로 이동합니다. (렌더 중 상태 갱신 패턴)
  if (focus?.nonce !== seenNonce) {
    setSeenNonce(focus?.nonce)
    setSelectedId(focus?.bookId ?? null)
  }

  const book = selectedId == null ? null : books.find((b) => b.id === selectedId) || null

  // 창 본문(.win__body)이 스크롤 영역입니다. 상세는 맨 위에서, 목록으로 돌아오면 보던 위치에서 시작합니다.
  useEffect(() => {
    const box = rootRef.current?.closest('.win__body')
    if (box) box.scrollTop = book ? 0 : listScrollRef.current
  }, [book?.id])

  const openBook = (id) => {
    listScrollRef.current = rootRef.current?.closest('.win__body')?.scrollTop ?? 0
    setSelectedId(id)
  }

  return (
    <div ref={rootRef}>
      {book && (
        <div className="m-page">
          <button type="button" className="m-back" onClick={() => setSelectedId(null)}>
            ← 목록
          </button>
          <BookDetail
            readOnly
            book={book}
            reviews={listReviews(book.id)}
            readings={readings.filter((r) => r.bookId === book.id)}
            quotes={quotes.filter((q) => q.bookId === book.id)}
            onViewReview={(review) => onViewReview(book, review)}
          />
        </div>
      )}

      {/* 목록은 계속 마운트해 두고 숨깁니다. 상세를 보고 돌아와도 검색어/필터가 유지됩니다. */}
      <div hidden={Boolean(book)}>
        <BookList books={books} selectedBookId={null} onSelectBook={openBook} onAddBook={() => {}} />
      </div>
    </div>
  )
}
