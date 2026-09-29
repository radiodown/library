import { useMemo, useRef, useState } from 'react'

/** 배열에서 from 위치 항목을 to 위치로 옮긴 새 배열을 반환합니다. */
function moveItem(list, from, to) {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * "서재 랭킹" 창의 내용. 서재의 책을 순위대로 꽂아 두고, 드래그 또는 ▲▼ 버튼으로 순서를 바꿉니다.
 * 꽂지 않은 책은 오른쪽 목록에서 원하는 순위 자리로 끌어다 놓거나 "꽂기"로 맨 아래에 추가합니다.
 */
export default function RankingWindow({ isReady, books, rankingIds, saveRanking, onOpenLibrary }) {
  const dragRef = useRef(null) // { from: 'rank', index } | { from: 'pool', bookId }
  const [overIndex, setOverIndex] = useState(null)

  const bookMap = useMemo(() => new Map(books.map((b) => [b.id, b])), [books])
  const ranked = useMemo(
    () => rankingIds.map((id) => bookMap.get(id)).filter(Boolean),
    [rankingIds, bookMap],
  )
  const pool = useMemo(() => {
    const inRanking = new Set(rankingIds)
    return books.filter((b) => !inRanking.has(b.id))
  }, [books, rankingIds])

  if (!isReady) {
    return (
      <div className="ranking ranking--empty">
        <p>먼저 서재 파일을 열거나 새로 만들어야 합니다.</p>
        <button type="button" onClick={onOpenLibrary}>
          서재 열기
        </button>
      </div>
    )
  }

  const ids = ranked.map((b) => b.id)

  const insertAt = (bookId, index) => {
    const next = [...ids]
    next.splice(index, 0, bookId)
    saveRanking(next)
  }

  const handleDrop = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    const drag = dragRef.current
    dragRef.current = null
    setOverIndex(null)
    if (!drag) return
    if (drag.from === 'rank') {
      if (drag.index !== index) saveRanking(moveItem(ids, drag.index, index))
    } else {
      insertAt(drag.bookId, index)
    }
  }

  const startDrag = (e, payload) => {
    dragRef.current = payload
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '') // Firefox는 데이터가 있어야 드래그가 시작됨
  }

  const endDrag = () => {
    dragRef.current = null
    setOverIndex(null)
  }

  return (
    <div className="ranking">
      <section className="ranking__col">
        <h3>내 랭킹 ({ranked.length})</h3>
        <ol
          className="ranking__list"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, ranked.length)}
        >
          {ranked.length === 0 && (
            <li className="ranking__empty">오른쪽에서 책을 꽂아 보세요.</li>
          )}
          {ranked.map((book, i) => (
            <li
              key={book.id}
              className={`ranking__item${overIndex === i ? ' is-over' : ''}`}
              draggable
              onDragStart={(e) => startDrag(e, { from: 'rank', index: i })}
              onDragEnd={endDrag}
              onDragOver={(e) => {
                e.preventDefault()
                setOverIndex(i)
              }}
              onDrop={(e) => handleDrop(e, i)}
            >
              <span className="ranking__no">{i + 1}</span>
              {book.coverUrl ? (
                <img className="ranking__cover" src={book.coverUrl} alt="" draggable={false} />
              ) : (
                <span className="ranking__cover" />
              )}
              <span className="ranking__info">
                <strong>{book.title}</strong>
                <span>{book.author}</span>
              </span>
              <span className="ranking__actions">
                <button
                  type="button"
                  aria-label="위로"
                  disabled={i === 0}
                  onClick={() => saveRanking(moveItem(ids, i, i - 1))}
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label="아래로"
                  disabled={i === ranked.length - 1}
                  onClick={() => saveRanking(moveItem(ids, i, i + 1))}
                >
                  ▼
                </button>
                <button
                  type="button"
                  aria-label="랭킹에서 빼기"
                  onClick={() => saveRanking(ids.filter((id) => id !== book.id))}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="ranking__col">
        <h3>꽂을 수 있는 책 ({pool.length})</h3>
        <ul className="ranking__list">
          {pool.length === 0 && (
            <li className="ranking__empty">
              {books.length === 0 ? '서재에 책이 없습니다.' : '모든 책이 랭킹에 꽂혀 있습니다.'}
            </li>
          )}
          {pool.map((book) => (
            <li
              key={book.id}
              className="ranking__item"
              draggable
              onDragStart={(e) => startDrag(e, { from: 'pool', bookId: book.id })}
              onDragEnd={endDrag}
            >
              <span className="ranking__info">
                <strong>{book.title}</strong>
                <span>{book.author}</span>
              </span>
              <span className="ranking__actions">
                <button type="button" onClick={() => insertAt(book.id, ranked.length)}>
                  꽂기
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
