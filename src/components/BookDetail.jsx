import { toPreviewText } from '../utils/reviewPreview'
import ReadingHistory from './ReadingHistory'
import QuoteList from './QuoteList'
import { todayString } from '../utils/stats'

const STATUS_LABEL = {
  wishlist: '읽고 싶음',
  reading: '읽는 중',
  finished: '완독',
}

/** 선택된 책의 정보와 감상문 목록. 감상문 작성/수정은 별도의 뜨는 창에서 이루어집니다. */
export default function BookDetail({
  readOnly = false, // 모바일: 보기만 가능하고 작성/수정/삭제 버튼을 숨깁니다
  book,
  reviews,
  readings,
  quotes,
  saveReading,
  removeReading,
  saveQuote,
  removeQuote,
  addOrUpdateBook,
  removeReview,
  onAddReview,
  onEditReview,
  onViewReview,
  onEditBook,
  onDeleteBook,
}) {
  const today = todayString()
  // 다시 읽는 중인 회차: 시작은 했지만 아직 완독일이 없는 재독 기록
  const activeReread = readings.find((r) => r.startDate && !r.finishDate)

  // 상태에 맞는 "지금 할 일" 버튼 하나. 클릭하면 오늘 날짜로 자동 기록합니다.
  const progressAction = (() => {
    if (activeReread) {
      return {
        label: `■ ${readings.indexOf(activeReread) + 2}회차 읽기 완료`,
        run: () => saveReading({ ...activeReread, finishDate: today }),
      }
    }
    if (book.status === 'wishlist') {
      return {
        label: '▶ 읽기 시작',
        // 읽고 싶음 상태에서 미리 들어 있던 날짜는 무시하고 오늘부터 시작으로 기록
        run: () => addOrUpdateBook({ ...book, status: 'reading', startDate: today, finishDate: '' }),
      }
    }
    if (book.status === 'reading') {
      return {
        label: '■ 읽기 완료',
        run: () => addOrUpdateBook({ ...book, status: 'finished', finishDate: today }),
      }
    }
    return {
      label: '↻ 다시 읽기 시작',
      run: () =>
        saveReading({ bookId: book.id, startDate: today, finishDate: '', rating: null, memo: '' }),
    }
  })()

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
          {!readOnly && (
            <div className="book-detail__actions">
              <button
                type="button"
                className="book-detail__progress"
                title={`오늘(${today})로 기록됩니다`}
                onClick={progressAction.run}
              >
                {progressAction.label}
              </button>
              <button onClick={onEditBook}>정보 수정</button>
              <button onClick={onDeleteBook} className="danger">
                책 삭제
              </button>
            </div>
          )}
        </div>
      </div>

      <ReadingHistory
        readOnly={readOnly}
        book={book}
        readings={readings}
        saveReading={saveReading}
        removeReading={removeReading}
      />

      <QuoteList
        readOnly={readOnly}
        book={book}
        quotes={quotes}
        saveQuote={saveQuote}
        removeQuote={removeQuote}
      />

      <div className="book-detail__reviews">
        <div className="book-detail__reviews-header">
          <h3>독서감상문</h3>
          {!readOnly && <button onClick={onAddReview}>+ 감상문 추가</button>}
        </div>

        {reviews.length === 0 && (
          <p className="book-detail__empty">
            {readOnly ? '작성된 감상문이 없습니다.' : '아직 작성한 감상문이 없습니다.'}
          </p>
        )}

        <ul className="review-list">
          {reviews.map((review) => (
            <li key={review.id} className="review-list__item">
              <div className="review-list__meta">
                <span className="format-badge">{review.format}</span>
                <span>{review.content.length.toLocaleString()}자</span>
                <span>{new Date(review.updatedAt).toLocaleString()}</span>
                <div className="review-list__item-actions">
                  <button onClick={() => onViewReview(review)}>보기</button>
                  {!readOnly && (
                    <>
                      <button onClick={() => onEditReview(review)}>수정</button>
                      <button onClick={() => handleDeleteReview(review.id)} className="danger">
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p className="review-list__preview">
                {toPreviewText(review.format, review.content)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
