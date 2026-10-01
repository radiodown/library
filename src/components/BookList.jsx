import { useEffect, useMemo, useRef, useState } from 'react'
import Fuse from 'fuse.js'
import StatusIcon from './StatusIcon'

const STATUS_LABEL = {
  wishlist: '읽고 싶음',
  reading: '읽는 중',
  finished: '완독',
}

const STATUS_OPTIONS = ['all', 'wishlist', 'reading', 'finished']

/** 저장된 시각(ISO)을 이 컴퓨터 시간대의 'YYYY-MM-DD'로 */
function localDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 정렬 기준.
 * - get: 비교할 값. 비어 있는(null/'') 책은 방향과 상관없이 항상 맨 뒤로 갑니다.
 * - desc: 처음 골랐을 때의 방향 (날짜와 별점은 최근/높은 것부터, 글자는 가나다순)
 * - show: 목록 각 줄에 함께 보여 줄 값. 제목/저자는 이미 보이므로 없습니다.
 * 'default'는 정렬하지 않고 원래 순서(최근 수정순, 검색 중에는 정확도순)를 그대로 쓰며 방향도 바꿀 수 없습니다.
 */
const SORTS = {
  default: { label: '최근 수정순', searchLabel: '정확도순' },
  title: { label: '제목', kind: 'text', get: (b) => b.title, desc: false },
  author: { label: '저자', kind: 'text', get: (b) => b.author, desc: false },
  rating: { label: '별점', kind: 'rating', get: (b) => b.rating, desc: true, show: (b) => (b.rating ? '★'.repeat(b.rating) : null) },
  finished: { label: '완독일', kind: 'date', get: (b) => b.finishDate, desc: true, show: (b) => b.finishDate || null },
  started: { label: '시작일', kind: 'date', get: (b) => b.startDate, desc: true, show: (b) => b.startDate || null },
  added: { label: '추가일', kind: 'date', get: (b) => b.createdAt, desc: true, show: (b) => localDate(b.createdAt) },
}

// 방향 버튼 툴팁: [오름차순, 내림차순]
const DIRECTION_TEXT = {
  text: ['가나다순', '가나다 역순'],
  date: ['오래된 날짜부터', '최근 날짜부터'],
  rating: ['낮은 별점부터', '높은 별점부터'],
}

const isEmpty = (v) => v == null || v === ''

function sortBooks(list, sort, desc) {
  const compare = (a, b) => {
    const va = sort.get(a)
    const vb = sort.get(b)
    if (isEmpty(va) || isEmpty(vb)) return isEmpty(va) - isEmpty(vb) // 빈 값은 항상 뒤로
    const diff = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ko')
    return desc ? -diff : diff
  }
  return [...list].sort(compare) // 같은 값끼리는 원래 순서(최근 수정순)를 유지합니다
}

/**
 * 책 검색/필터/목록 표시. Fuse.js로 제목·저자·태그 퍼지 검색을 지원합니다.
 * onBookContextMenu(book, event): 책을 오른쪽 클릭했을 때 (없으면 브라우저 기본 메뉴)
 * onListContextMenu(event): 목록의 빈 곳을 오른쪽 클릭했을 때
 */
export default function BookList({ books, selectedBookId, onSelectBook, onBookContextMenu, onListContextMenu }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState('default')
  const [reversed, setReversed] = useState(false) // 기준의 처음 방향에서 뒤집었는지
  const sort = SORTS[sortKey]
  const desc = sort.get ? sort.desc !== reversed : null
  const itemsRef = useRef(null)

  // 선택한 책이 바뀌면(검색/통계 창에서 "이 책 보기"로 온 경우 등) 목록 안에서 그 책이 보이게 스크롤합니다.
  // 바깥 창이나 바탕화면까지 움직이지 않도록 scrollIntoView 대신 목록의 scrollTop만 조절합니다.
  useEffect(() => {
    const list = itemsRef.current
    const item = list?.querySelector('li.is-selected')
    if (!item) return
    const top = item.offsetTop - list.offsetTop
    const bottom = top + item.offsetHeight
    if (top < list.scrollTop) list.scrollTop = top
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
  }, [selectedBookId])

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
    return sort.get ? sortBooks(result, sort, desc) : result
  }, [books, fuse, query, statusFilter, sort, desc])

  const searching = Boolean(query.trim())
  const [ascText, descText] = DIRECTION_TEXT[sort.kind] || []
  const directionTitle = sort.get
    ? `${desc ? descText : ascText} (누르면 ${desc ? ascText : descText})`
    : '이 순서는 방향을 바꿀 수 없습니다'

  const handleTabKeyDown = (e) => {
    const i = STATUS_OPTIONS.indexOf(statusFilter)
    const last = STATUS_OPTIONS.length - 1
    const next =
      e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (next === null) return
    e.preventDefault()
    setStatusFilter(STATUS_OPTIONS[next])
    e.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus()
  }

  return (
    <div className="book-list">
      <div className="book-list__header">
        <h2>서재</h2>
      </div>

      <input
        className="book-list__search"
        type="search"
        placeholder="제목, 저자, 태그로 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <label className="book-list__sort">
        정렬
        <select
          value={sortKey}
          onChange={(e) => {
            setSortKey(e.target.value)
            setReversed(false) // 기준을 바꾸면 그 기준의 기본 방향부터
          }}
        >
          {Object.entries(SORTS).map(([key, s]) => (
            <option key={key} value={key}>
              {searching && s.searchLabel ? s.searchLabel : s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="book-list__direction"
          onClick={() => setReversed((r) => !r)}
          disabled={!sort.get}
          title={directionTitle}
          aria-label={directionTitle}
        >
          {desc === false ? '▲' : '▼'}
        </button>
      </label>

      {/* 읽기 상태 필터: 98 속성 창처럼 목록 위에 붙은 탭. 선택된 탭이 앞으로 나와 목록과 이어집니다. */}
      <div className="book-list__tabs" role="tablist" aria-label="읽기 상태" onKeyDown={handleTabKeyDown}>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={statusFilter === s}
            tabIndex={statusFilter === s ? 0 : -1}
            className={`book-list__tab${statusFilter === s ? ' is-active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? '전체' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="book-list__sheet" role="tabpanel">
        <ul
          className="book-list__items"
          ref={itemsRef}
          onContextMenu={
            onListContextMenu &&
            ((e) => {
              if (e.target.closest('li[data-book-id]')) return
              e.preventDefault()
              onListContextMenu(e)
            })
          }
        >
          {filtered.length === 0 && <li className="book-list__empty">책이 없습니다.</li>}
          {filtered.map((book) => (
            <li
              key={book.id}
              data-book-id={book.id}
              className={book.id === selectedBookId ? 'is-selected' : ''}
              onClick={() => onSelectBook(book.id)}
              onContextMenu={
                onBookContextMenu &&
                ((e) => {
                  e.preventDefault()
                  onBookContextMenu(book, e)
                })
              }
            >
              {/* 98 탐색기처럼 제목 왼쪽에 읽기 상태 아이콘 */}
              <StatusIcon status={book.status} />
              <div className="book-list__text">
                <div className="book-list__title">{book.title}</div>
                {/* 저자도 정렬 값도 없는 책은 한 줄로 줄어듭니다 */}
                {(book.author || sort.show?.(book)) && (
                  <div className="book-list__meta">
                    {book.author && <span>{book.author}</span>}
                    {/* 지금 정렬 기준의 값: 순서가 왜 이런지 바로 보이게 */}
                    {sort.show?.(book) && <span className="book-list__sort-value">{sort.show(book)}</span>}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
