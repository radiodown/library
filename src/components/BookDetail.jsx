import ReviewViewer from './ReviewViewer'

const STATUS_LABEL = {
  wishlist: '읽고 싶음',
  reading: '읽는 중',
  finished: '완독',
}

/** 선택된 책의 정보와 감상문 목록. 감상문 작성/수정은 별도의 뜨는 창에서 이루어집니다. */
export default function BookDetail({
  book,
  reviews,
  removeReview,
  onAddReview,
  onEditReview,
  onEditBook,
  onDeleteBook,
}) {
  const handleDeleteReview = (id) => {
    if (!window.confirm('이 감상문을 삭제할까요?')) return
    removeReview(id)
  }

  return (
    <div className="book-detail">
      <div className="book-detail__header">
        <div className="book-detail__cover">
          {book.coverUrl ? <img src={book.coverUrl} alt={book.title} /> : <div className="book-detail__cover--placeholder" />}
        </div>
        <div className="book-detail__info">
          <h2>{book.title}</h2>
          {book.author && <p className="book-detail__author">{book.author}</p>}
          <p>
            <span className={`status-badge status-badge--${book.status}`}>{STATUS_LABEL[book.status]}</span>
            {book.rating ? <span className="book-detail__rating">{'★'.repeat(book.rating)}</span> : null}
          </p>
          {(book.startDate || book.finishDate) && (
            <p className="book-detail__dates">
              {book.startDate || '?'} ~ {book.finishDate || '읽는 중'}
            </p>
          )}
          {book.tags.length > 0 && (
            <p className="book-detail__tags">
              {book.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  #{tag}
                </span>
              ))}
            </p>
          )}
          <div className="book-detail__actions">
            <button onClick={onEditBook}>정보 수정</button>
            <button onClick={onDeleteBook} className="danger">
              책 삭제
            </button>
          </div>
        </div>
      </div>

      <div className="book-detail__reviews">
        <div className="book-detail__reviews-header">
          <h3>독서감상문</h3>
          <button onClick={onAddReview}>+ 감상문 추가</button>
        </div>

        {reviews.length === 0 && <p className="book-detail__empty">아직 작성한 감상문이 없습니다.</p>}

        <ul className="review-list">
          {reviews.map((review) => (
            <li key={review.id} className="review-list__item">
              <div className="review-list__meta">
                <span className="format-badge">{review.format}</span>
                <span>{new Date(review.updatedAt).toLocaleString()}</span>
                <div className="review-list__item-actions">
                  <button onClick={() => onEditReview(review)}>수정</button>
                  <button onClick={() => handleDeleteReview(review.id)} className="danger">
                    삭제
                  </button>
                </div>
              </div>
              <ReviewViewer format={review.format} content={review.content} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
