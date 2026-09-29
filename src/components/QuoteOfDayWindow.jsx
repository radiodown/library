import { useMemo, useState } from 'react'
import { todayString } from '../utils/stats'
import PixelIcon from './PixelIcon'

/** 'YYYY-MM-DD'를 숫자로 바꿔 하루 동안 같은 인용구가 나오게 하는 시작 위치를 만듭니다. */
function dayIndex(today, length) {
  return Number(today.replaceAll('-', '')) % length
}

/**
 * "오늘의 인용구" 팝업의 내용. Windows 98 알림창처럼 왼쪽에 아이콘, 오른쪽에 문장을 두고
 * 아래에 [다른 인용구] [확인] 버튼을 놓습니다. 저장해 둔 인용구 중 오늘 날짜에 맞는 하나를 보여 줍니다.
 */
export default function QuoteOfDayWindow({ isReady, books, quotes, onOpenLibrary, onClose }) {
  const [offset, setOffset] = useState(0)

  // 인용구가 추가/삭제돼도 오늘의 인용구가 흔들리지 않도록 id 순서로 고정합니다.
  const pool = useMemo(() => {
    const bookMap = new Map(books.map((b) => [b.id, b]))
    return [...quotes]
      .sort((a, b) => a.id - b.id)
      .map((q) => ({ ...q, book: bookMap.get(q.bookId) }))
      .filter((q) => q.book)
  }, [books, quotes])

  const dialog = (body, buttons) => (
    <div className="quote-dialog">
      <div className="quote-dialog__body">
        <span className="quote-dialog__icon">
          <PixelIcon name="quote" size={32} />
        </span>
        <div className="quote-dialog__content">{body}</div>
      </div>
      <div className="quote-dialog__buttons">{buttons}</div>
    </div>
  )

  const confirmButton = (
    <button type="button" className="quote-dialog__btn" onClick={onClose} autoFocus>
      확인
    </button>
  )

  if (!isReady || pool.length === 0) {
    return dialog(
      <p className="quote-dialog__text">
        {!isReady
          ? '먼저 서재 파일을 열거나 새로 만들어야 합니다.'
          : '아직 저장한 인용구가 없습니다. 책 상세에서 "+ 인용구 추가"로 좋았던 문장을 남겨 보세요.'}
      </p>,
      <>
        {!isReady && onOpenLibrary && (
          <button type="button" className="quote-dialog__btn" onClick={onOpenLibrary}>
            서재 열기
          </button>
        )}
        {confirmButton}
      </>,
    )
  }

  const index = (dayIndex(todayString(), pool.length) + offset) % pool.length
  const quote = pool[index]

  return dialog(
    <>
      <p className="quote-dialog__text">{quote.content}</p>
      <p className="quote-dialog__source">
        — <strong>{quote.book.title}</strong>
        {quote.book.author && `, ${quote.book.author}`}
        {quote.page != null && ` (p.${quote.page})`}
      </p>
    </>,
    <>
      <button
        type="button"
        className="quote-dialog__btn"
        onClick={() => setOffset((o) => o + 1)}
        disabled={pool.length < 2}
      >
        다른 인용구
      </button>
      {confirmButton}
      <span className="quote-dialog__count">
        {index + 1} / {pool.length}
      </span>
    </>,
  )
}
