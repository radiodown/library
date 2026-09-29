import { useMemo, useState } from 'react'
import { todayString } from '../utils/stats'

/** 'YYYY-MM-DD'를 숫자로 바꿔 하루 동안 같은 인용구가 나오게 하는 시작 위치를 만듭니다. */
function dayIndex(today, length) {
  return Number(today.replaceAll('-', '')) % length
}

/**
 * "오늘의 인용구" 창의 내용. 저장해 둔 인용구 중 오늘 날짜에 맞는 하나를 보여 주고,
 * "다른 인용구"로 다음 것을 넘겨 볼 수 있습니다.
 */
export default function QuoteOfDayWindow({ isReady, books, quotes, onOpenLibrary }) {
  const [offset, setOffset] = useState(0)

  // 인용구가 추가/삭제돼도 오늘의 인용구가 흔들리지 않도록 id 순서로 고정합니다.
  const pool = useMemo(() => {
    const bookMap = new Map(books.map((b) => [b.id, b]))
    return [...quotes]
      .sort((a, b) => a.id - b.id)
      .map((q) => ({ ...q, book: bookMap.get(q.bookId) }))
      .filter((q) => q.book)
  }, [books, quotes])

  if (!isReady) {
    return (
      <div className="quote-day quote-day--empty">
        <p>먼저 서재 파일을 열거나 새로 만들어야 합니다.</p>
        <button type="button" onClick={onOpenLibrary}>
          서재 열기
        </button>
      </div>
    )
  }

  if (pool.length === 0) {
    return (
      <div className="quote-day quote-day--empty">
        <p>아직 저장한 인용구가 없습니다.</p>
        <p className="stats__hint">서재에서 책을 선택하고 &quot;+ 인용구 추가&quot;로 좋았던 문장을 남겨 보세요.</p>
        <button type="button" onClick={onOpenLibrary}>
          서재 열기
        </button>
      </div>
    )
  }

  const index = (dayIndex(todayString(), pool.length) + offset) % pool.length
  const quote = pool[index]

  return (
    <div className="quote-day">
      <p className="quote-day__label">💬 오늘의 인용구</p>
      <blockquote className="quote-day__text">{quote.content}</blockquote>
      <p className="quote-day__source">
        — <strong>{quote.book.title}</strong>
        {quote.book.author && `, ${quote.book.author}`}
        {quote.page != null && ` (p.${quote.page})`}
      </p>
      <div className="quote-day__actions">
        <button type="button" onClick={() => setOffset((o) => o + 1)} disabled={pool.length < 2}>
          다른 인용구
        </button>
        <span className="quote-day__count">
          {index + 1} / {pool.length}
        </span>
      </div>
    </div>
  )
}
