import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Fuse from 'fuse.js'
import { toPreviewText } from '../utils/reviewPreview'
import { splitNames } from '../utils/people'
import MenuBar from './MenuBar'
import PixelIcon from './PixelIcon'
import Stars from './Stars'

const STATUS_LABEL = {
  wishlist: '읽고 싶음',
  reading: '읽는 중',
  finished: '완독',
}
const STATUS_ORDER = { wishlist: 0, reading: 1, finished: 2 }

const TYPE_TABS = [
  { key: 'all', label: '전체' },
  { key: 'book', label: '책' },
  { key: 'review', label: '감상문' },
  { key: 'quote', label: '인용구' },
]

const TYPE_LABEL = { book: '책', review: '감상문', quote: '인용구' }
const TYPE_ICON = { book: 'book-open', review: 'notepad', quote: 'quote' }

// 탐색기의 "보기" 메뉴처럼 네 가지 방식으로 볼 수 있습니다.
const VIEW_KEY = 'library:search-view'
const VIEWS = [
  { key: 'large', label: '큰 아이콘' },
  { key: 'small', label: '작은 아이콘' },
  { key: 'list', label: '목록' },
  { key: 'details', label: '자세히' },
]

function readView() {
  try {
    const saved = localStorage.getItem(VIEW_KEY)
    if (saved === 'grid') return 'large' // 예전 버전의 "그리드"
    return VIEWS.some((v) => v.key === saved) ? saved : 'list'
  } catch {
    return 'list'
  }
}

// "자세히" 보기의 열. width는 처음 폭(px)이고 머리글 경계를 끌어 조절합니다.
const COLUMNS = [
  { key: 'name', label: '이름', width: 220 },
  { key: 'kind', label: '종류', width: 70 },
  { key: 'author', label: '저자', width: 130 },
  { key: 'status', label: '상태', width: 80 },
  { key: 'rating', label: '별점', width: 70 },
  { key: 'snippet', label: '내용', width: 320 },
]

const SNIPPET_RADIUS = 50
const MAX_RESULTS_PER_TYPE = 50
const EMPTY_TEXT = '(내용 없음)'

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 모든 검색어가 (대소문자 무시하고) 본문에 들어 있는지. 감상문처럼 긴 글은 퍼지 검색이 노이즈가 많아 정확히 찾습니다. */
function matchesAll(text, terms) {
  const lower = text.toLowerCase()
  return terms.every((t) => lower.includes(t))
}

/** 첫 번째 일치 위치 주변만 잘라 보여 줍니다. */
function makeSnippet(text, terms) {
  const lower = text.toLowerCase()
  const first = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0))
  if (!Number.isFinite(first)) return text.slice(0, SNIPPET_RADIUS * 2)
  const start = Math.max(0, first - SNIPPET_RADIUS)
  const end = Math.min(text.length, first + SNIPPET_RADIUS * 2)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

/** 검색어와 일치하는 부분을 <mark>로 감쌉니다. (텍스트 노드로만 그리므로 본문의 태그는 실행되지 않습니다) */
function Highlight({ text, terms }) {
  if (terms.length === 0) return text
  const re = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>,
  )
}

const compareText = (a, b) => (a || '').localeCompare(b || '', 'ko')

/** 머리글을 눌렀을 때의 정렬 기준. 값이 없는 행(별점 없음 등)은 방향과 상관없이 맨 뒤로 보냅니다. */
function compareBy(col, dir) {
  return (a, b) => {
    if (col === 'rating') {
      if (a.rating == null && b.rating == null) return 0
      if (a.rating == null) return 1
      if (b.rating == null) return -1
      return (a.rating - b.rating) * dir
    }
    if (col === 'status') return ((STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)) * dir
    const value = (item) => (col === 'kind' ? TYPE_LABEL[item.type] : item[col])
    return compareText(value(a), value(b)) * dir
  }
}

/**
 * "검색" 창 (Windows 98 "파일 찾기" 모양). 책(제목·저자·역자·출판사·태그), 감상문 본문, 인용구를 한 번에 찾습니다.
 * 상태/별점/태그 등 필터는 책의 속성이므로, 그 책에 딸린 감상문·인용구에도 똑같이 적용됩니다.
 * 결과는 한 번 누르면 선택, 더블클릭이나 Enter로 열립니다. (터치 기기는 한 번 누르면 열립니다)
 */
export default function SearchWindow({
  isReady,
  books,
  quotes,
  listAllReviews,
  reviewsVersion,
  onOpenLibrary,
  onOpenBook,
  onOpenReview,
  onClose,
  filter, // { kind: 'author'|'translator'|'publisher', name, nonce } — 책 상세에서 이름을 눌러 열 때
}) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [minRating, setMinRating] = useState(0)
  const [tag, setTag] = useState('')
  const [view, setViewState] = useState(readView) // 다음에 열 때도 기억합니다
  const [author, setAuthor] = useState(filter?.kind === 'author' ? filter.name : '')
  const [translator, setTranslator] = useState(filter?.kind === 'translator' ? filter.name : '')
  const [publisher, setPublisher] = useState(filter?.kind === 'publisher' ? filter.name : '')
  const [seenNonce, setSeenNonce] = useState(filter?.nonce)
  const [selectedKey, setSelectedKey] = useState(null)
  const [sort, setSort] = useState({ col: null, dir: 1 })
  const [widths, setWidths] = useState(() => COLUMNS.map((c) => c.width))
  const itemRefs = useRef(new Map())

  const resetConditions = (next = {}) => {
    setQuery('')
    setType('all')
    setStatus('all')
    setMinRating(0)
    setTag('')
    setAuthor(next.kind === 'author' ? next.name : '')
    setTranslator(next.kind === 'translator' ? next.name : '')
    setPublisher(next.kind === 'publisher' ? next.name : '')
    setSelectedKey(null)
  }

  // 열려 있는 창에 새 필터 요청이 오면 다른 조건은 모두 풀고 그 이름으로만 거릅니다. (렌더 중 상태 갱신 패턴)
  if (filter?.nonce !== seenNonce) {
    setSeenNonce(filter?.nonce)
    resetConditions(filter)
  }

  const setView = (next) => {
    setViewState(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // 저장할 수 없어도 이번 세션에서는 바뀐 대로 보입니다.
    }
  }

  const bookMap = useMemo(() => new Map(books.map((b) => [b.id, b])), [books])
  const nameOptions = useMemo(() => {
    const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b, 'ko'))
    return {
      authors: sorted(new Set(books.flatMap((b) => splitNames(b.author)))),
      translators: sorted(new Set(books.flatMap((b) => splitNames(b.translator)))),
      publishers: sorted(new Set(books.map((b) => b.publisher?.trim()).filter(Boolean))),
    }
  }, [books])
  const allTags = useMemo(
    () => [...new Set(books.flatMap((b) => b.tags))].sort((a, b) => a.localeCompare(b, 'ko')),
    [books],
  )

  // 감상문 본문을 평문으로 바꿔 둡니다. 감상문이 바뀌면(reviewsVersion) 다시 만듭니다.
  const reviewDocs = useMemo(
    () =>
      listAllReviews()
        .filter((r) => bookMap.has(r.bookId))
        .map((r) => ({ ...r, text: [r.title, toPreviewText(r.format, r.content, Infinity)].filter(Boolean).join(' ') }))
        .filter((r) => r.text !== EMPTY_TEXT),
    // reviewsVersion은 값이 아니라 "감상문이 바뀌었다"는 신호입니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listAllReviews, reviewsVersion, bookMap],
  )

  const fuse = useMemo(
    () =>
      new Fuse(books, {
        keys: ['title', 'author', 'translator', 'publisher', 'tags', 'isbn'],
        threshold: 0.35,
      }),
    [books],
  )

  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query])
  const hasFilter =
    status !== 'all' || minRating > 0 || tag !== '' || author !== '' || translator !== '' || publisher !== ''

  const results = useMemo(() => {
    const passesFilter = (book) =>
      !!book &&
      (status === 'all' || book.status === status) &&
      (minRating === 0 || (book.rating ?? 0) >= minRating) &&
      (tag === '' || book.tags.includes(tag)) &&
      (author === '' || splitNames(book.author).includes(author)) &&
      (translator === '' || splitNames(book.translator).includes(translator)) &&
      (publisher === '' || book.publisher?.trim() === publisher)

    // 검색어도 필터도 없으면 아무것도 보여 주지 않습니다.
    if (terms.length === 0 && !hasFilter) return null

    const want = (t) => type === 'all' || type === t
    const out = { books: [], reviews: [], quotes: [] }

    if (want('book')) {
      const found = terms.length ? fuse.search(query.trim()).map((r) => r.item) : books
      out.books = found.filter(passesFilter)
    }
    // 감상문/인용구는 검색어가 있어야 의미가 있습니다. (필터만 걸었을 땐 책 목록만 보여 줌)
    if (terms.length && want('review')) {
      out.reviews = reviewDocs
        .filter((r) => passesFilter(bookMap.get(r.bookId)) && matchesAll(r.text, terms))
        .map((r) => ({ ...r, snippet: makeSnippet(r.text, terms) }))
    }
    if (terms.length && want('quote')) {
      out.quotes = quotes
        .filter((q) => passesFilter(bookMap.get(q.bookId)) && matchesAll(q.content, terms))
        .map((q) => ({ ...q, snippet: makeSnippet(q.content.replace(/\s+/g, ' '), terms) }))
    }
    return out
  }, [terms, hasFilter, type, status, minRating, tag, author, translator, publisher, query, fuse, books, reviewDocs, quotes, bookMap])

  // 종류가 다른 결과를 한 줄짜리 항목으로 통일합니다. (종류별로 항목당 50개까지만)
  const items = useMemo(() => {
    if (!results) return []
    const out = []
    results.books.slice(0, MAX_RESULTS_PER_TYPE).forEach((b) =>
      out.push({
        key: `book-${b.id}`,
        type: 'book',
        bookId: b.id,
        name: b.title,
        author: b.author,
        status: b.status,
        rating: b.rating,
        cover: b.coverUrl,
        sub: [b.author, b.publisher].filter(Boolean).join(' · '),
        snippet: '',
      }),
    )
    results.reviews.slice(0, MAX_RESULTS_PER_TYPE).forEach((r) => {
      const book = bookMap.get(r.bookId)
      out.push({
        key: `review-${r.id}`,
        type: 'review',
        bookId: book.id,
        book,
        review: r,
        name: book.title,
        author: book.author,
        status: book.status,
        rating: book.rating,
        snippet: r.snippet,
      })
    })
    results.quotes.slice(0, MAX_RESULTS_PER_TYPE).forEach((q) => {
      const book = bookMap.get(q.bookId)
      out.push({
        key: `quote-${q.id}`,
        type: 'quote',
        bookId: book.id,
        name: q.page ? `${book.title} · p.${q.page}` : book.title,
        author: book.author,
        status: book.status,
        rating: book.rating,
        snippet: q.snippet,
      })
    })
    return out
  }, [results, bookMap])

  // 화면에 보이는 순서. "자세히"에서는 머리글로 정렬한 순서, 나머지는 책→감상문→인용구 순서입니다.
  const ordered = useMemo(
    () => (view === 'details' && sort.col ? [...items].sort(compareBy(sort.col, sort.dir)) : items),
    [items, view, sort],
  )
  const selected = ordered.find((it) => it.key === selectedKey) || null

  // 키보드로 옮긴 선택이 스크롤 영역 밖이면 보이게 합니다.
  useEffect(() => {
    if (selectedKey) itemRefs.current.get(selectedKey)?.scrollIntoView({ block: 'nearest' })
  }, [selectedKey])

  if (!isReady) {
    return (
      <div className="search-window search-window--empty">
        <p>먼저 서재 파일을 열거나 새로 만들어야 합니다.</p>
        <button type="button" onClick={onOpenLibrary}>
          서재 열기
        </button>
      </div>
    )
  }

  const openItem = (item) => {
    if (item.type === 'review') onOpenReview(item.book, item.review)
    else onOpenBook(item.bookId)
  }

  const handleItemClick = (item) => {
    setSelectedKey(item.key)
    // 터치 기기에서는 더블클릭이 어려우므로 한 번 누르면 바로 엽니다.
    if (window.matchMedia('(pointer: coarse)').matches) openItem(item)
  }

  const handleKeyDown = (e) => {
    if (ordered.length === 0) return
    const index = ordered.findIndex((it) => it.key === selectedKey)
    let next = null
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = Math.min(index + 1, ordered.length - 1)
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = Math.max(index - 1, 0)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = ordered.length - 1
    else if (e.key === 'Enter' && selected) {
      e.preventDefault()
      openItem(selected)
      return
    }
    if (next === null) return
    e.preventDefault()
    setSelectedKey(ordered[next].key)
  }

  const toggleSort = (col) =>
    setSort((s) => (s.col === col ? { col, dir: -s.dir } : { col, dir: 1 }))

  // 머리글 경계를 끌어 열 폭을 조절합니다.
  const startResize = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = widths[index]
    const move = (ev) =>
      setWidths((w) => w.map((x, i) => (i === index ? Math.max(40, startWidth + ev.clientX - startX) : x)))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const itemProps = (item) => ({
    ref: (el) => {
      if (el) itemRefs.current.set(item.key, el)
      else itemRefs.current.delete(item.key)
    },
    role: 'option',
    'aria-selected': item.key === selectedKey,
    className: item.key === selectedKey ? 'is-selected' : '',
    onClick: () => handleItemClick(item),
    onDoubleClick: () => openItem(item),
  })

  const menus = [
    { label: '파일(F)', items: [{ label: '닫기', onClick: () => onClose() }] },
    {
      label: '편집(E)',
      items: [
        { label: '열기', shortcut: 'Enter', onClick: () => selected && openItem(selected), disabled: !selected },
        { separator: true },
        { label: '새로 찾기', onClick: () => resetConditions() },
      ],
    },
    {
      label: '보기(V)',
      items: VIEWS.map((v) => ({
        label: `${view === v.key ? '✓' : '  '} ${v.label}`,
        onClick: () => setView(v.key),
      })),
    },
  ]

  const total = results ? results.books.length + results.reviews.length + results.quotes.length : 0
  const truncated = results && [results.books, results.reviews, results.quotes].some((l) => l.length > MAX_RESULTS_PER_TYPE)

  // 종류별 제목 + 항목. "자세히"가 아닌 보기에서 씁니다.
  const renderSection = (kind, label, count) => {
    const list = items.filter((it) => it.type === kind)
    if (list.length === 0) return null
    return (
      <section key={kind}>
        <h3>
          {label} ({count})
        </h3>
        <ul className={`search-window__items is-${view}`} role="presentation">
          {list.map((item) => (
            <li key={item.key} {...itemProps(item)} title={view === 'small' ? item.snippet || item.name : undefined}>
              {view === 'large' &&
                item.type === 'book' &&
                (item.cover ? (
                  <img className="search-window__cover" src={item.cover} alt="" loading="lazy" />
                ) : (
                  <span className="search-window__cover search-window__cover--none" />
                ))}
              <span className="search-window__title">
                <PixelIcon name={TYPE_ICON[item.type]} className="pixel-icon--inline" />{' '}
                {item.type === 'book' ? <Highlight text={item.name} terms={terms} /> : item.name}
              </span>
              {view !== 'small' && item.type === 'book' && (
                <span className="search-window__meta">
                  {item.sub}
                  <span className={`status-badge status-badge--${item.status}`}>{STATUS_LABEL[item.status]}</span>
                  <Stars value={item.rating} className="book-detail__rating" />
                </span>
              )}
              {view !== 'small' && item.type !== 'book' && (
                <span className="search-window__snippet">
                  <Highlight text={item.snippet} terms={terms} />
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <div className="search-window">
      <MenuBar menus={menus} />

      <div className="search-window__content">
        <fieldset className="search-window__group">
          <legend>검색 조건</legend>
          <div className="search-window__bar">
            <PixelIcon name="search" className="pixel-icon--inline" />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="책 제목, 저자, 감상문·인용구 내용 (공백으로 여러 단어)"
              aria-label="검색어"
            />
            <button type="button" onClick={() => resetConditions()}>
              새로 찾기
            </button>
          </div>

          <div className="search-window__filters">
            <label>
              보기
              <select value={view} onChange={(e) => setView(e.target.value)}>
                {VIEWS.map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              상태
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">전체</option>
                {Object.entries(STATUS_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              별점
              <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
                <option value={0}>전체</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {'★'.repeat(n)} 이상
                  </option>
                ))}
              </select>
            </label>
            <label>
              저자
              <select value={author} onChange={(e) => setAuthor(e.target.value)}>
                <option value="">전체</option>
                {nameOptions.authors.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {nameOptions.translators.length > 0 && (
              <label>
                역자
                <select value={translator} onChange={(e) => setTranslator(e.target.value)}>
                  <option value="">전체</option>
                  {nameOptions.translators.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {nameOptions.publishers.length > 0 && (
              <label>
                출판사
                <select value={publisher} onChange={(e) => setPublisher(e.target.value)}>
                  <option value="">전체</option>
                  {nameOptions.publishers.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              태그
              <select value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">전체</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <div className="search-window__tabs" role="tablist">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={type === t.key}
              className={type === t.key ? 'is-active' : ''}
              onClick={() => setType(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="search-window__sheet">
          <div
            className="search-window__results"
            role="listbox"
            aria-label="검색 결과"
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            {!results && (
              <p className="search-window__hint">
                검색어를 입력하거나 조건을 골라 보세요. 감상문과 인용구는 본문까지 찾아 줍니다.
              </p>
            )}

            {results && total === 0 && <p className="search-window__hint">검색 결과가 없습니다.</p>}

            {results && total > 0 && view !== 'details' && (
              <>
                {renderSection('book', '책', results.books.length)}
                {renderSection('review', '감상문', results.reviews.length)}
                {renderSection('quote', '인용구', results.quotes.length)}
              </>
            )}

            {results && total > 0 && view === 'details' && (
              <table className="search-table" style={{ width: widths.reduce((a, b) => a + b, 0) }}>
                <colgroup>
                  {widths.map((w, i) => (
                    <col key={COLUMNS[i].key} style={{ width: w }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {COLUMNS.map((c, i) => (
                      <th
                        key={c.key}
                        aria-sort={sort.col === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                      >
                        <button type="button" onClick={() => toggleSort(c.key)}>
                          {c.label}
                          {sort.col === c.key && <span aria-hidden="true"> {sort.dir === 1 ? '▲' : '▼'}</span>}
                        </button>
                        <span
                          className="search-table__grip"
                          onPointerDown={(e) => startResize(e, i)}
                          title="끌어서 폭 조절"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((item) => (
                    <tr key={item.key} {...itemProps(item)}>
                      <td>
                        <PixelIcon name={TYPE_ICON[item.type]} className="pixel-icon--inline" />{' '}
                        {item.type === 'book' ? <Highlight text={item.name} terms={terms} /> : item.name}
                      </td>
                      <td>{TYPE_LABEL[item.type]}</td>
                      <td>{item.author}</td>
                      <td>{STATUS_LABEL[item.status]}</td>
                      <td><Stars value={item.rating} /></td>
                      <td>
                        <Highlight text={item.snippet} terms={terms} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="search-window__statusbar" role="status">
          <span>
            {results ? `${total}개 항목을 찾았습니다.${truncated ? ` (종류별 ${MAX_RESULTS_PER_TYPE}개까지만 표시)` : ''}` : '검색어를 입력하세요.'}
          </span>
          {selected && (
            <span>
              선택: {selected.name} ({TYPE_LABEL[selected.type]})
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
