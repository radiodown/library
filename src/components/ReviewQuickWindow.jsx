import { useState } from 'react'
import BookForm from './BookForm'
import StatusIcon from './StatusIcon'
import { listReviewDrafts } from '../utils/reviewDrafts'
import { toPreviewText } from '../utils/reviewPreview'

// 감상문을 쓸 가능성이 높은 순서: 읽는 중 → 완독 → 읽고 싶음 (같은 상태 안에서는 최근 수정순 유지)
const STATUS_ORDER = { reading: 0, finished: 1, wishlist: 2 }

export default function ReviewQuickWindow({ isReady, books, libraryId, listReviews, addOrUpdateBook, onOpenReview, onOpenLibrary }) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const selected = books.find((b) => b.id === selectedId)
  const matches = books
    .filter((b) => (b.title + ' ' + b.author).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3))
  if (!isReady) return <div className="review-quick review-quick--empty"><p>먼저 서재를 열거나 새로 만들어 주세요.</p><button onClick={onOpenLibrary}>서재 열기</button></div>
  if (adding) return <BookForm books={books} defaults={{ status: 'reading' }} heading="새 책 추가" submitLabel="책 추가" onCancel={() => setAdding(false)} onSave={(book) => {
    const id = addOrUpdateBook(book)
    setSelectedId(id)
    setAdding(false)
  }} />
  return (
    <div className="review-quick review-picker">
      <h2>어떤 책의 이야기를 남길까요?</h2>
      <p className="review-quick__hint">서재의 책을 골라 새 감상문을 쓰거나, 쓰던 글을 이어 쓰세요.</p>
      <div className="review-picker__search"><input aria-label="감상문 쓸 책 검색" placeholder="제목 또는 저자 검색" value={query} onChange={(e) => setQuery(e.target.value)} /><button onClick={() => setAdding(true)}>새 책 추가</button></div>
      <div className="review-picker__columns">
        <div className="review-picker__books" aria-label="감상문 쓸 책 목록">
          {!matches.length && <p>{books.length ? '검색 결과가 없습니다.' : '아직 책이 없습니다. 새 책을 추가해 주세요.'}</p>}
          {matches.map((book) => {
            const count = listReviews(book.id).length
            return (
              <button key={book.id} aria-pressed={selectedId === book.id} onClick={() => setSelectedId(book.id)}>
                {/* 상태는 아이콘으로만 (버튼 이름은 제목·저자로 유지) */}
                <span className="review-picker__icon" aria-hidden="true"><StatusIcon status={book.status} /></span>
                <span className="review-picker__text">
                  <strong>{book.title}</strong>
                  <span>{book.author || '저자 미상'}{count > 0 && ` · 감상문 ${count}`}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="review-picker__reviews">
          {selected ? <>
            <h3>{selected.title}</h3>
            <button onClick={() => onOpenReview(selected, null)}>새 감상문 쓰기</button>
            {listReviewDrafts(libraryId, selected, listReviews(selected.id)).map(({ key, draft }) => <button className="review-picker__review" key={key} onClick={() => onOpenReview(selected, null, key)}><strong>{draft.title || toPreviewText(draft.format, draft.content, 40)}</strong><span>초안 이어 쓰기 · {new Date(draft.savedAt).toLocaleString('ko-KR')}</span></button>)}
            <h4>저장한 감상문</h4>
            {listReviews(selected.id).length === 0 && <p>첫 감상문을 남겨 보세요.</p>}
            {listReviews(selected.id).map((review) => <button className="review-picker__review" key={review.id} onClick={() => onOpenReview(selected, review)}><strong>{review.title || toPreviewText(review.format, review.content, 40)}</strong><span>{new Date(review.updatedAt).toLocaleDateString('ko-KR')} · {review.content.length.toLocaleString()}자</span></button>)}
          </> : <p>왼쪽에서 책을 선택하세요.</p>}
        </div>
      </div>
    </div>
  )
}
