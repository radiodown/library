import { useMemo, useRef, useState } from 'react'

const STATUS_LABEL = { wishlist: '읽고 싶음', reading: '읽는 중', finished: '완독' }

/** 배열에서 from 위치 항목을 to 위치로 옮긴 새 배열을 반환합니다. */
function moveItem(list, from, to) {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * "다음 책" 창의 내용. 다음에 읽을 책을 순서대로 꽂아 두고, 드래그 또는 ▲▼ 버튼으로 순서를 바꿉니다.
 * 읽기 시작해도 목록에 남아 있고(완독하면 자동으로 빠집니다), 오른쪽에서 꽂을 수 있는 책은
 * "읽고 싶음"과 "읽는 중"인 책입니다. "무작위로 뽑기"는 읽고 싶음 책 중 하나를 골라 줍니다.
 */
export default function NextBooksWindow({ isReady, books, nextBookIds, saveNextBooks, onOpenLibrary, onOpenBook }) {
  const dragRef = useRef(null) // { from: 'list', index } | { from: 'pool', bookId }
  const [overIndex, setOverIndex] = useState(null)
  const [pick, setPick] = useState(null) // 무작위로 뽑힌 책 id

  const bookMap = useMemo(() => new Map(books.map((b) => [b.id, b])), [books])
  const queued = useMemo(
    () => nextBookIds.map((id) => bookMap.get(id)).filter(Boolean),
    [nextBookIds, bookMap],
  )
  const pool = useMemo(() => {
    const inList = new Set(nextBookIds)
    return books.filter((b) => b.status !== 'finished' && !inList.has(b.id))
  }, [books, nextBookIds])
  const wishlist = useMemo(() => books.filter((b) => b.status === 'wishlist'), [books])

  if (!isReady) {
    return (
      <div className="next-books next-books--empty">
        <p>먼저 서재 파일을 열거나 새로 만들어야 합니다.</p>
        <button type="button" onClick={onOpenLibrary}>
          서재 열기
        </button>
      </div>
    )
  }

  const ids = queued.map((b) => b.id)
  const picked = pick == null ? null : bookMap.get(pick) || null

  const insertAt = (bookId, index) => {
    const next = [...ids]
    next.splice(index, 0, bookId)
    saveNextBooks(next)
  }

  // 같은 책이 연속으로 나오지 않게, 가능하면 직전에 뽑은 책은 제외합니다.
  const drawRandom = () => {
    const candidates = wishlist.length > 1 ? wishlist.filter((b) => b.id !== pick) : wishlist
    if (candidates.length === 0) return
    setPick(candidates[Math.floor(Math.random() * candidates.length)].id)
  }

  const handleDrop = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    const drag = dragRef.current
    dragRef.current = null
    setOverIndex(null)
    if (!drag) return
    if (drag.from === 'list') {
      if (drag.index !== index) saveNextBooks(moveItem(ids, drag.index, index))
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
    <div className="next-books">
      <div className="next-books__pick">
        <button type="button" onClick={drawRandom} disabled={wishlist.length === 0}>
          🎲 무작위로 뽑기
        </button>
        {wishlist.length === 0 && <span className="next-books__pick-hint">읽고 싶음 책이 없습니다.</span>}
        {picked && (
          <div className="next-books__result" role="status">
            <span>
              이번엔 <strong>{picked.title}</strong>
              {picked.author ? ` (${picked.author})` : ''} 어때요?
            </span>
            <span className="next-books__result-actions">
              {!nextBookIds.includes(picked.id) && (
                <button type="button" onClick={() => insertAt(picked.id, queued.length)}>
                  다음 책에 추가
                </button>
              )}
              <button type="button" onClick={() => onOpenBook(picked.id)}>
                책 보기
              </button>
              <button type="button" onClick={drawRandom} disabled={wishlist.length < 2}>
                다시 뽑기
              </button>
            </span>
          </div>
        )}
      </div>

      <div className="next-books__cols">
        <section className="next-books__col">
          <h3>다음 책 ({queued.length})</h3>
          <ol
            className="next-books__list"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, queued.length)}
          >
            {queued.length === 0 && <li className="next-books__empty">오른쪽에서 책을 꽂아 보세요.</li>}
            {queued.map((book, i) => (
              <li
                key={book.id}
                className={`next-books__item${overIndex === i ? ' is-over' : ''}`}
                draggable
                onDragStart={(e) => startDrag(e, { from: 'list', index: i })}
                onDragEnd={endDrag}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverIndex(i)
                }}
                onDrop={(e) => handleDrop(e, i)}
              >
                <span className="next-books__no">{i + 1}</span>
                {book.coverUrl ? (
                  <img className="next-books__cover" src={book.coverUrl} alt="" draggable={false} />
                ) : (
                  <span className="next-books__cover" />
                )}
                <span className="next-books__info">
                  <strong>{book.title}</strong>
                  <span>
                    {[book.author, STATUS_LABEL[book.status]].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="next-books__actions">
                  <button
                    type="button"
                    aria-label="위로"
                    disabled={i === 0}
                    onClick={() => saveNextBooks(moveItem(ids, i, i - 1))}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="아래로"
                    disabled={i === queued.length - 1}
                    onClick={() => saveNextBooks(moveItem(ids, i, i + 1))}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    aria-label="다음 책에서 빼기"
                    onClick={() => saveNextBooks(ids.filter((id) => id !== book.id))}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="next-books__col">
          <h3>꽂을 수 있는 책 ({pool.length})</h3>
          <ul className="next-books__list">
            {pool.length === 0 && (
              <li className="next-books__empty">
                {books.length === 0 ? '서재에 책이 없습니다.' : '꽂을 수 있는 책이 없습니다.'}
              </li>
            )}
            {pool.map((book) => (
              <li
                key={book.id}
                className="next-books__item"
                draggable
                onDragStart={(e) => startDrag(e, { from: 'pool', bookId: book.id })}
                onDragEnd={endDrag}
              >
                <span className="next-books__info">
                  <strong>{book.title}</strong>
                  <span>{[book.author, STATUS_LABEL[book.status]].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="next-books__actions">
                  <button type="button" onClick={() => insertAt(book.id, queued.length)}>
                    꽂기
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
