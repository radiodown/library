import { useMemo } from 'react'

/** 모바일용 랭킹. 순위대로 보기만 하고, 책을 누르면 상세로 이동합니다. */
export default function MobileRanking({ books, rankingIds, onOpenBook }) {
  const ranked = useMemo(() => {
    const bookMap = new Map(books.map((b) => [b.id, b]))
    return rankingIds.map((id) => bookMap.get(id)).filter(Boolean)
  }, [books, rankingIds])

  if (ranked.length === 0) {
    return (
      <p className="m-empty">
        아직 랭킹이 없습니다.
        <br />
        PC에서 시작 메뉴 → 서재 랭킹으로 책을 꽂아 보세요.
      </p>
    )
  }

  return (
    <ol className="m-ranking">
      {ranked.map((book, i) => (
        <li key={book.id}>
          <button type="button" onClick={() => onOpenBook(book.id)}>
            <span className="m-ranking__no">{i + 1}</span>
            {book.coverUrl ? (
              <img className="m-ranking__cover" src={book.coverUrl} alt="" />
            ) : (
              <span className="m-ranking__cover" />
            )}
            <span className="m-ranking__info">
              <strong>{book.title}</strong>
              {book.author && <span>{book.author}</span>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
