import { Fragment } from 'react'
import { useDialog } from './dialogContext'
import { toPreviewText } from '../utils/reviewPreview'
import ReadingHistory from './ReadingHistory'
import QuoteList from './QuoteList'
import ItemActions from './ItemActions'
import StatusIcon from './StatusIcon'
import Stars from './Stars'
import { useContextMenu } from '../hooks/useContextMenu'
import { splitNames } from '../utils/people'

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

/**
 * 선택된 책의 정보와 감상문 목록. 감상문 작성/수정은 별도의 뜨는 창에서 이루어집니다.
 * 읽기 시작, 회차/인용구/감상문 추가, 수정, 삭제는 서재 창의 도구 모음과 메뉴에 있습니다.
 */
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
  removeReview,
  onEditReview,
  onViewReview,
  onSearchBy, // (kind: 'author'|'translator'|'publisher', name) => void
  addRequest, // { kind: 'reading'|'quote', bookId, nonce } 도구 모음/메뉴에서 "추가"를 누르면 바뀝니다
}) {
  const dialog = useDialog()
  const contextMenu = useContextMenu()

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
            <StatusIcon status={book.status} withLabel />
            <Stars value={book.rating} className="book-detail__rating" />
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
        </div>
      </div>

      <ReadingHistory
        readOnly={readOnly}
        book={book}
        readings={readings}
        saveReading={saveReading}
        removeReading={removeReading}
        addRequest={addRequest?.kind === 'reading' && addRequest.bookId === book.id ? addRequest.nonce : null}
      />

      <QuoteList
        readOnly={readOnly}
        book={book}
        quotes={quotes}
        saveQuote={saveQuote}
        removeQuote={removeQuote}
        addRequest={addRequest?.kind === 'quote' && addRequest.bookId === book.id ? addRequest.nonce : null}
      />

      <div className="book-detail__reviews">
        <div className="book-detail__reviews-header">
          <h3>독서감상문</h3>
        </div>

        {reviews.length === 0 && (
          <p className="book-detail__empty">
            {readOnly ? '작성된 감상문이 없습니다.' : '아직 작성한 감상문이 없습니다. 도구 모음의 "감상문"으로 써 보세요.'}
          </p>
        )}

        <ul className="review-list">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="review-list__item"
              title="더블클릭하면 감상문을 엽니다"
              // 98식: 항목을 더블클릭하면 엽니다. (아이콘 버튼을 빠르게 두 번 누른 경우는 제외)
              onDoubleClick={(e) => !e.target.closest('button') && onViewReview(review)}
              onMouseDown={(e) => e.detail > 1 && e.preventDefault()} // 더블클릭이 글자를 선택하지 않게
              onContextMenu={(e) =>
                contextMenu.open(e, [
                  { label: '보기', bold: true, onClick: () => onViewReview(review) },
                  ...(readOnly
                    ? []
                    : [
                        { label: '수정...', onClick: () => onEditReview(review) },
                        { separator: true },
                        { label: '삭제', onClick: () => handleDeleteReview(review.id) },
                      ]),
                ])
              }
            >
              <div className="review-list__meta">
                {review.title && <strong>{review.title}</strong>}
                <span className="format-badge">{review.format}</span>
                <span>{review.content.length.toLocaleString()}자</span>
                <span>{new Date(review.updatedAt).toLocaleString()}</span>
                <ItemActions
                  actions={[
                    { icon: 'eye', label: '감상문 보기', onClick: () => onViewReview(review) },
                    ...(readOnly
                      ? []
                      : [
                          { icon: 'pencil', label: '감상문 수정', onClick: () => onEditReview(review) },
                          { icon: 'trash-lid', label: '감상문 삭제', onClick: () => handleDeleteReview(review.id), danger: true },
                        ]),
                  ]}
                />
              </div>
              <p className="review-list__preview">
                {toPreviewText(review.format, review.content)}
              </p>
            </li>
          ))}
        </ul>
      </div>
      {contextMenu.menu}
    </div>
  )
}
