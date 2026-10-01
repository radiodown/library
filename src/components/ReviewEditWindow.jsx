import { useState } from 'react'
import ReviewEditor from './ReviewEditor'
import StatusIcon from './StatusIcon'
import Stars from './Stars'
import { readReviewDraft, reviewDraftKey } from '../utils/reviewDrafts'

/** 어떤 책에 대해 쓰는지 보여 주는 띠: 작은 표지, 제목·저자, 읽기 상태, 별점, 읽은 기간 */
function BookBand({ book }) {
  const period = book.dateUnknown
    ? '읽은 시기 미상'
    : book.startDate || book.finishDate
      ? `${book.startDate || '?'} ~ ${book.finishDate || '읽는 중'}`
      : null
  return (
    <div className="review-band">
      {book.coverUrl ? (
        <img className="review-band__cover" src={book.coverUrl} alt="" />
      ) : (
        <span className="review-band__cover review-band__cover--empty" aria-hidden="true" />
      )}
      <div className="review-band__info">
        <div className="review-band__title">
          <strong>{book.title}</strong>
          {book.author && <span className="review-band__author">{book.author}</span>}
        </div>
        <div className="review-band__meta">
          <StatusIcon status={book.status} withLabel />
          <Stars value={book.rating} className="book-detail__rating" />
          {period && <span>{period}</span>}
        </div>
      </div>
    </div>
  )
}

export default function ReviewEditWindow({ book, review, recoveryKey, libraryId, listReviews, quotes, saveReview, onDone, registerEditor, onSaved }) {
  const [session] = useState(() => {
    const key = recoveryKey || reviewDraftKey(libraryId, book, review?.id)
    const draft = readReviewDraft(key)
    const existing = review || (draft?.reviewId ? listReviews(book.id).find((r) => r.id === draft.reviewId && r.createdAt === draft.reviewCreatedAt) : null)
    return { key, review: existing }
  })
  const handleSave = (nextReview) => {
    const id = saveReview(nextReview, libraryId)
    const stored = listReviews(book.id).find((r) => r.id === id)
    onSaved(stored)
    return stored
  }
  return (
    <div className="review-edit-window">
      <ReviewEditor
        review={session.review}
        bookId={book.id}
        draftKey={session.key}
        savedDraftKey={(id) => reviewDraftKey(libraryId, book, id)}
        quotes={quotes.filter((q) => q.bookId === book.id)}
        header={<BookBand book={book} />}
        onSave={handleSave}
        onClose={onDone}
        registerEditor={registerEditor}
      />
    </div>
  )
}
