import { useMemo, useState } from 'react'
import Fuse from 'fuse.js'

const STATUS_LABEL = {
  wishlist: '읽고 싶음',
  reading: '읽는 중',
  finished: '완독',
}

const STATUS_OPTIONS = ['all', 'wishlist', 'reading', 'finished']

/** 책 검색/필터/목록 표시. Fuse.js로 제목·저자·태그 퍼지 검색을 지원합니다. */
export default function BookList({ books, selectedBookId, onSelectBook, onAddBook }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const fuse = useMemo(
    () =>
      new Fuse(books, {
        keys: ['title', 'author', 'tags'],
        threshold: 0.35,
      }),
    [books],
  )

  const filtered = useMemo(() => {
    let result = query.trim() ? fuse.search(query).map((r) => r.item) : books
    if (statusFilter !== 'all') {
      result = result.filter((b) => b.status === statusFilter)
    }
    return result
  }, [books, fuse, query, statusFilter])

  return (
    <div className="book-list">
      <div className="book-list__header">
        <h2>서재</h2>
        <button onClick={onAddBook}>+ 책 추가</button>
      </div>

      <input
        className="book-list__search"
        type="search"
        placeholder="제목, 저자, 태그로 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="book-list__filters">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            className={statusFilter === s ? 'is-active' : ''}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? '전체' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <ul className="book-list__items">
        {filtered.length === 0 && <li className="book-list__empty">책이 없습니다.</li>}
        {filtered.map((book) => (
          <li
            key={book.id}
            className={book.id === selectedBookId ? 'is-selected' : ''}
            onClick={() => onSelectBook(book.id)}
          >
            <div className="book-list__title">{book.title}</div>
            <div className="book-list__meta">
              {book.author && <span>{book.author}</span>}
              <span className={`status-badge status-badge--${book.status}`}>
                {STATUS_LABEL[book.status]}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
