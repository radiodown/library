import { Fragment, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import { toPreviewText } from '../utils/reviewPreview'
import { splitNames } from '../utils/people'
import PixelIcon from './PixelIcon'

const STATUS_LABEL = {
  wishlist: '읽고 싶음',
  reading: '읽는 중',
  finished: '완독',
}

const TYPE_TABS = [
  { key: 'all', label: '전체' },
  { key: 'book', label: '책' },
  { key: 'review', label: '감상문' },
  { key: 'quote', label: '인용구' },
]

const VIEW_KEY = 'library:search-view'
const VIEWS = [
  { key: 'list', label: '리스트' },
  { key: 'grid', label: '그리드' },
]

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

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

/**
 * "검색" 창. 책(제목·저자·역자·출판사·태그), 감상문 본문, 인용구를 한 번에 찾습니다.
 * 상태/별점/태그 필터는 책의 속성이므로, 그 책에 딸린 감상문·인용구에도 똑같이 적용됩니다.
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
  filter, // { kind: 'author'|'translator'|'publisher', name, nonce } — 책 상세에서 이름을 눌러 열 때
}) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [minRating, setMinRating] = useState(0)
  const [tag, setTag] = useState('')
  const [view, setViewState] = useState(readView) // 'list' | 'grid' — 다음에 열 때도 기억합니다
  const [author, setAuthor] = useState(filter?.kind === 'author' ? filter.name : '')
  const [translator, setTranslator] = useState(filter?.kind === 'translator' ? filter.name : '')
  const [publisher, setPublisher] = useState(filter?.kind === 'publisher' ? filter.name : '')
  const [seenNonce, setSeenNonce] = useState(filter?.nonce)

  // 열려 있는 창에 새 필터 요청이 오면 다른 조건은 모두 풀고 그 이름으로만 거릅니다. (렌더 중 상태 갱신 패턴)
  if (filter?.nonce !== seenNonce) {
    setSeenNonce(filter?.nonce)
    setQuery('')
    setType('all')
    setStatus('all')
    setMinRating(0)
    setTag('')
    setAuthor(filter?.kind === 'author' ? filter.name : '')
    setTranslator(filter?.kind === 'translator' ? filter.name : '')
    setPublisher(filter?.kind === 'publisher' ? filter.name : '')
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
        .map((r) => ({ ...r, text: toPreviewText(r.format, r.content, Infinity) }))
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

  const terms = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )
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

  const total = results ? results.books.length + results.reviews.length + results.quotes.length : 0
  const cap = (list) => list.slice(0, MAX_RESULTS_PER_TYPE)

  return (
    <div className="search-window">
      <div className="search-window__bar">
        <PixelIcon name="search" className="pixel-icon--inline" />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="책 제목, 저자, 감상문·인용구 내용으로 검색 (공백으로 여러 단어)"
          aria-label="검색어"
        />
      </div>

      <div className="search-window__filters">
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
        <div className="search-window__views" role="group" aria-label="보기 방식">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              aria-pressed={view === v.key}
              className={view === v.key ? 'is-active' : ''}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
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

      {(author || translator || publisher) && (
        <p className="search-window__active">
          {author && <span>저자: {author}</span>}
          {translator && <span>역자: {translator}</span>}
          {publisher && <span>출판사: {publisher}</span>}
        </p>
      )}

      <div className="search-window__results">
        {!results && (
          <p className="search-window__hint">
            검색어를 입력하거나 필터를 골라 보세요. 감상문과 인용구는 본문까지 찾아 줍니다.
          </p>
        )}

        {results && total === 0 && <p className="search-window__hint">검색 결과가 없습니다.</p>}

        {results && results.books.length > 0 && (
          <section>
            <h3>책 ({results.books.length})</h3>
            <ul className={`search-window__items is-${view}`}>
              {cap(results.books).map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => onOpenBook(b.id)}>
                    {view === 'grid' &&
                      (b.coverUrl ? (
                        <img className="search-window__cover" src={b.coverUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="search-window__cover search-window__cover--none" />
                      ))}
                    <span className="search-window__title">
                      <Highlight text={b.title} terms={terms} />
                    </span>
                    <span className="search-window__meta">
                      {[b.author, b.publisher].filter(Boolean).join(' · ')}
                      <span className={`status-badge status-badge--${b.status}`}>
                        {STATUS_LABEL[b.status]}
                      </span>
                      {b.rating ? <span className="book-detail__rating">{'★'.repeat(b.rating)}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {results && results.reviews.length > 0 && (
          <section>
            <h3>감상문 ({results.reviews.length})</h3>
            <ul className={`search-window__items is-${view}`}>
              {cap(results.reviews).map((r) => {
                const book = bookMap.get(r.bookId)
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => onOpenReview(book, r)}>
                      <span className="search-window__title">{book.title}</span>
                      <span className="search-window__snippet">
                        <Highlight text={r.snippet} terms={terms} />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {results && results.quotes.length > 0 && (
          <section>
            <h3>인용구 ({results.quotes.length})</h3>
            <ul className={`search-window__items is-${view}`}>
              {cap(results.quotes).map((q) => {
                const book = bookMap.get(q.bookId)
                return (
                  <li key={q.id}>
                    <button type="button" onClick={() => onOpenBook(q.bookId)}>
                      <span className="search-window__title">
                        {book.title}
                        {q.page ? ` · p.${q.page}` : ''}
                      </span>
                      <span className="search-window__snippet">
                        <Highlight text={q.snippet} terms={terms} />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {results && total > 0 && [results.books, results.reviews, results.quotes].some((l) => l.length > MAX_RESULTS_PER_TYPE) && (
          <p className="search-window__hint">
            항목당 {MAX_RESULTS_PER_TYPE}개까지만 보여 줍니다. 검색어를 더 구체적으로 입력해 보세요.
          </p>
        )}
      </div>
    </div>
  )
}
