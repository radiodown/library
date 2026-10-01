import { useState } from 'react'
import ReviewEditor from './ReviewEditor'
import PixelIcon from './PixelIcon'
import { readReviewDraft, reviewDraftKey } from '../utils/reviewDrafts'

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
      <p className="review-quick__active-book"><PixelIcon name="book-open" className="pixel-icon--inline" /> <strong>{book.title}</strong>{book.author && ' · ' + book.author}</p>
      <ReviewEditor review={session.review} bookId={book.id} draftKey={session.key} savedDraftKey={(id) => reviewDraftKey(libraryId, book, id)} quotes={quotes.filter((q) => q.bookId === book.id)} onSave={handleSave} onClose={onDone} registerEditor={registerEditor} />
    </div>
  )
}
