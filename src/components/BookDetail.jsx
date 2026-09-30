import { Fragment } from 'react'
import { useDialog } from './dialogContext'
import { toPreviewText } from '../utils/reviewPreview'
import ReadingHistory from './ReadingHistory'
import QuoteList from './QuoteList'
import { todayString } from '../utils/stats'
import { splitNames } from '../utils/people'

const STATUS_LABEL = {
  wishlist: '읽고 싶음',
  reading: '읽는 중',
  finished: '완독',
}

/** 저자/역자/출판사 이름들. onSearchBy가 있으면 이름을 눌러 그 사람(출판사)의 책을 모아 볼 수 있습니다. */
function PersonLinks({ kind, names, onSearchBy }) {
  return names.map((name, i) => (
    <Fragment key={name}>
      {i > 0 && ', '}
      {onSearchBy ? (
        <button
          type="button"
          className="person-link"
          title={`"${name}"의 책 모아보기`}
          onClick={() => onSearchBy(kind, name)}
        >
          {name}
        </button>
      ) : (
        name
      )}
    </Fragment>
  ))
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
  onSearchBy, // (kind: 'author'|'translator'|'publisher', name) => void
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
        run: () => addOrUpdateBook({ ...book, status: 'reading', startDate: today, finishDate: '', dateUnknown: false }),
      }
    }
    if (book.status === 'reading') {
      return {
        label: '■ 읽기 완료',
        run: () => addOrUpdateBook({ ...book, status: 'finished', finishDate: today, dateUnknown: false }),
      }
    }
    return {
      label: '↻ 다시 읽기 시작',
      run: () =>
        saveReading({ bookId: book.id, startDate: today, finishDate: '', rating: null, memo: '' }),
    }
  })()

  const dialog = useDialog()

  const handleDeleteReview = async (id) => {
    if (!(await dialog.confirm('이 감상문을 삭제할까요?', { title: '감상문 삭제', okLabel: '삭제' }))) return
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
          {book.author && (
            <p className="book-detail__author">
              <PersonLinks kind="author" names={splitNames(book.author)} onSearchBy={onSearchBy} />
            </p>
          )}
          {(book.translator || book.publisher) && (
            <p className="book-detail__meta">
              {book.translator && (
                <>
                  <PersonLinks kind="translator" names={splitNames(book.translator)} onSearchBy={onSearchBy} /> 옮김
                </>
              )}
              {book.translator && book.publisher && ' · '}
              {book.publisher && (
                <PersonLinks kind="publisher" names={[book.publisher.trim()]} onSearchBy={onSearchBy} />
              )}
            </p>
          )}
          <p>
            <span className={`status-badge status-badge--${book.status}`}>{STATUS_LABEL[book.status]}</span>
            {book.rating ? <span className="book-detail__rating">{'★'.repeat(book.rating)}</span> : null}
          </p>
          {book.dateUnknown ? (
            <p className="book-detail__dates">읽은 시기 미상</p>
          ) : (
            (book.startDate || book.finishDate) && (
              <p className="book-detail__dates">
                {book.startDate || '?'} ~ {book.finishDate || '읽는 중'}
              </p>
            )
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
