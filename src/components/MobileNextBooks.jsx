import { useMemo } from 'react'

/** 모바일용 "다음 책". 순서대로 보기만 하고, 책을 누르면 상세로 이동합니다. */
export default function MobileNextBooks({ books, nextBookIds, onOpenBook }) {
  const queued = useMemo(() => {
    const bookMap = new Map(books.map((b) => [b.id, b]))
    return nextBookIds.map((id) => bookMap.get(id)).filter(Boolean)
  }, [books, nextBookIds])

  if (queued.length === 0) {
    return (
      <p className="m-empty">
        아직 다음 책이 없습니다.
        <br />
        PC에서 시작 메뉴 → 다음 책으로 책을 꽂아 보세요.
      </p>
    )
  }

  return (
    <ol className="m-next">
      {queued.map((book, i) => (
        <li key={book.id}>
          <button type="button" onClick={() => onOpenBook(book.id)}>
            <span className="m-next__no">{i + 1}</span>
            {book.coverUrl ? (
              <img className="m-next__cover" src={book.coverUrl} alt="" />
            ) : (
              <span className="m-next__cover" />
            )}
            <span className="m-next__info">
              <strong>{book.title}</strong>
              {book.author && <span>{book.author}</span>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
