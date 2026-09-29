import ReviewViewer from './ReviewViewer'

/**
 * "감상문 보기" 창의 내용. 감상문마다 별도의 창으로 열리므로 여러 개를 나란히 띄워 놓고 읽을 수 있습니다.
 * review는 App이 매번 DB에서 다시 찾아 넘겨 주므로, 수정하면 열려 있는 이 창도 바로 갱신됩니다.
 */
export default function ReviewViewWindow({ bookTitle, review, onEdit }) {
  if (!review) {
    return (
      <div className="review-view-window">
        <p className="book-detail__empty">삭제되었거나 찾을 수 없는 감상문입니다. 이 창을 닫아 주세요.</p>
      </div>
    )
  }

  return (
    <div className="review-view-window">
      <div className="review-view-window__head">
        <p className="review-quick__active-book">
          📖 <strong>{bookTitle}</strong>
        </p>
        <div className="review-list__meta">
          <span className="format-badge">{review.format}</span>
          <span>{review.content.length.toLocaleString()}자</span>
          <span>수정 {new Date(review.updatedAt).toLocaleString()}</span>
          <div className="review-list__item-actions">
            <button type="button" onClick={onEdit}>
              수정
            </button>
          </div>
        </div>
      </div>
      <ReviewViewer format={review.format} content={review.content} />
    </div>
  )
}
