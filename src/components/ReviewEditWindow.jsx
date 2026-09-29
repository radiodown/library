import ReviewEditor from './ReviewEditor'
import PixelIcon from './PixelIcon'

/** "감상문 추가/수정" 창의 내용. 저장하거나 취소하면 이 창을 닫습니다. */
export default function ReviewEditWindow({ bookTitle, bookId, review, saveReview, onDone }) {
  const handleSave = (nextReview) => {
    saveReview(nextReview)
    onDone()
  }

  return (
    <div className="review-edit-window">
      <p className="review-quick__active-book">
        <PixelIcon name="book-open" className="pixel-icon--inline" /> <strong>{bookTitle}</strong> — {review ? '감상문 수정' : '새 감상문'}
      </p>
      <ReviewEditor review={review} bookId={bookId} onSave={handleSave} onCancel={onDone} />
    </div>
  )
}
