import { useMemo, useState } from 'react'
import Fuse from 'fuse.js'

const STATUS_LABEL = {
  wishlist: '읽고 싶음',
  reading: '읽는 중',
  finished: '완독',
}

const STATUS_OPTIONS = ['all', 'wishlist', 'reading', 'finished']

const byText = (key) => (a, b) => (a[key] || '').localeCompare(b[key] || '', 'ko')
// 값이 비어 있는 책은 방향과 상관없이 항상 맨 뒤로 보냅니다.
const byDateDesc = (key) => (a, b) => {
  if (!a[key] && !b[key]) return 0
  if (!a[key]) return 1
  if (!b[key]) return -1
  return b[key].localeCompare(a[key])
}
const byRatingDesc = (a, b) => {
  if (a.rating == null && b.rating == null) return 0
  if (a.rating == null) return 1
  if (b.rating == null) return -1
  return b.rating - a.rating
}

/** 'default'는 정렬하지 않고 원래 순서(최근 수정순, 검색 중에는 정확도순)를 그대로 씁니다. */
const SORTS = {
  default: { label: '기본', compare: null },
  title: { label: '제목순', compare: byText('title') },
  author: { label: '저자순', compare: byText('author') },
  rating: { label: '별점 높은순', compare: byRatingDesc },
  finished: { label: '완독일 최신순', compare: byDateDesc('finishDate') },
  started: { label: '시작일 최신순', compare: byDateDesc('startDate') },
  added: { label: '추가한 순', compare: byDateDesc('createdAt') },
}

/** 책 검색/필터/목록 표시. Fuse.js로 제목·저자·태그 퍼지 검색을 지원합니다. */
export default function BookList({ books, selectedBookId, onSelectBook, onAddBook }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState('default')

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
    const { compare } = SORTS[sortKey]
    return compare ? [...result].sort(compare) : result
  }, [books, fuse, query, statusFilter, sortKey])

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

      <label className="book-list__sort">
        정렬
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
          {Object.entries(SORTS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>

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
