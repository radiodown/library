import { useMemo, useState } from 'react'
import MenuBar from './MenuBar'

const STATUS_LABEL = { wishlist: '읽고 싶음', reading: '읽는 중', finished: '완독' }
const PREFS_KEY = 'library98-bookshelf'

// 책등 색. 카카오 표지 이미지는 CORS를 막아 색을 뽑을 수 없으므로, 서로 어울리는 톤에서 책마다 하나를 고릅니다.
const SPINE_COLORS = [
  { bg: '#7b2d26', fg: '#f3e6c8' },
  { bg: '#a0522d', fg: '#fbefd9' },
  { bg: '#2f4f4f', fg: '#e8e2cc' },
  { bg: '#1f3a5f', fg: '#e9dfc4' },
  { bg: '#556b2f', fg: '#f1ead2' },
  { bg: '#6b4c7a', fg: '#f2e8f0' },
  { bg: '#8b6914', fg: '#fff4d6' },
  { bg: '#9c3d54', fg: '#fbe9ec' },
  { bg: '#2e5e4e', fg: '#e3efe6' },
  { bg: '#4a4a6a', fg: '#ecebf5' },
  { bg: '#d8c8a0', fg: '#3b2a17' },
  { bg: '#c9a27e', fg: '#3a2412' },
  { bg: '#e4d9c3', fg: '#5a2a1e' },
]

// 숫자는 크기대로 비교해서 "토지 2"가 "토지 10"보다 앞에 오게 합니다.
const collator = new Intl.Collator('ko', { numeric: true })

/** 가나다순으로 비교하되, 값이 비어 있는 책은 맨 뒤로 보냅니다. */
function byText(a, b) {
  if (!a || !b) return !a - !b
  return collator.compare(a, b)
}

const SORTS = {
  added: { label: '추가한 순', compare: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') },
  title: { label: '제목순', compare: (a, b) => collator.compare(a.title, b.title) },
  author: {
    label: '저자순',
    compare: (a, b) => byText(a.author, b.author) || collator.compare(a.title, b.title),
  },
  // 출판사 → 저자 → 제목 순으로 고정합니다.
  publisher: {
    label: '출판사순',
    compare: (a, b) => byText(a.publisher, b.publisher) || SORTS.author.compare(a, b),
  },
  finished: {
    label: '완독일순',
    compare: (a, b) => (b.finishDate || '').localeCompare(a.finishDate || '') || SORTS.added.compare(a, b),
  },
}

/** 책마다 늘 같은 값이 나오는 간단한 해시. 책등의 색/두께/높이를 정합니다. */
function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// 제목의 권 번호: "토지 1", "삼국지 3권", "토지 제2부", "토지(2)", "해리 포터 Vol. 2", "총, 균, 쇠 (상)", "토지 1: 서장"
const VOLUME_PATTERNS = [
  /^(.+?)[\s,:-]*\b(?:vol|volume|no)\.?\s*(\d{1,3})$/i,
  /^(.+?)(?:\s+|\s*[([]\s*)(?:제\s*)?(\d{1,3})\s*(?:권|부|편)?\s*[)\]]?$/,
  /^(.+?)\s+(?:제\s*)?(\d{1,3})\s*(?:권|부|편)?\s*[:-]\s+\S.*$/,
  /^(.+?)(?:\s+|\s*[([]\s*)(상|중|하)\s*[)\]]?$/,
]

/** 제목에서 시리즈 이름과 권 번호를 떼어 냅니다. 권 번호가 없으면 null. */
function parseVolume(title) {
  for (const pattern of VOLUME_PATTERNS) {
    const m = title.trim().match(pattern)
    if (!m) continue
    const base = m[1].replace(/[\s,:-]+$/, '').replace(/\s+/g, ' ')
    if (base) return { base, volume: /\d/.test(m[2]) ? String(Number(m[2])) : m[2] }
  }
  return null
}

/**
 * 같은 저자의, 이름이 같고 권 번호만 다른 책이 두 권 이상이면 시리즈로 봅니다.
 * 책 id → { key, base, volume }. 시리즈 책은 같은 key로 책등을 그려 색/두께/높이가 같아집니다.
 */
function findSeries(books) {
  const groups = new Map()
  for (const book of books) {
    const parsed = parseVolume(book.title)
    if (!parsed) continue
    const author = book.author.split(',')[0].trim()
    const key = `${parsed.base.toLowerCase()}|${author}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ id: book.id, key, base: parsed.base, volume: parsed.volume })
  }
  const series = new Map()
  for (const members of groups.values()) {
    if (members.length > 1) members.forEach((m) => series.set(m.id, m))
  }
  return series
}

function spineStyle(book, series) {
  const h = hash(series ? `series:${series.key}` : `${book.id}:${book.isbn || book.title}`)
  const color = SPINE_COLORS[h % SPINE_COLORS.length]
  return {
    color,
    width: 22 + ((h >>> 5) % 15), // 22~36px
    height: 100 + ((h >>> 10) % 30), // 100~129px
    bands: (h >>> 16) % 3, // 0: 장식 없음, 1: 위아래 띠, 2: 위쪽 굵은 띠
  }
}

function readPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {}
    return {
      view: prefs.view === 'front' ? 'front' : 'spine',
      sort: SORTS[prefs.sort] ? prefs.sort : 'added',
      status: STATUS_LABEL[prefs.status] ? prefs.status : 'all',
    }
  } catch {
    return { view: 'spine', sort: 'added', status: 'all' }
  }
}

function tooltip(book) {
  return [book.title, book.author, STATUS_LABEL[book.status]].filter(Boolean).join(' · ')
}

function Spine({ book, series, onOpen }) {
  const { color, width, height, bands } = spineStyle(book, series)
  return (
    <button
      type="button"
      className={`bookshelf__spine bookshelf__spine--bands-${bands}`}
      style={{ width, height, background: color.bg, color: color.fg }}
      title={tooltip(book)}
      aria-label={tooltip(book)}
      onClick={() => onOpen(book.id)}
    >
      {book.status === 'reading' && <span className="bookshelf__ribbon" />}
      <span className="bookshelf__spine-title">{series ? series.base : book.title}</span>
      {book.author && width >= 28 && <span className="bookshelf__spine-author">{book.author}</span>}
      {series && <span className="bookshelf__spine-volume">{series.volume}</span>}
    </button>
  )
}

function FrontCover({ book, series, onOpen }) {
  const { color } = spineStyle(book, series)
  return (
    <button
      type="button"
      className="bookshelf__front"
      title={tooltip(book)}
      aria-label={tooltip(book)}
      onClick={() => onOpen(book.id)}
    >
      {book.coverUrl ? (
        <img src={book.coverUrl} alt="" draggable={false} />
      ) : (
        <span className="bookshelf__front-blank" style={{ background: color.bg, color: color.fg }}>
          {book.title}
        </span>
      )}
      {book.status === 'reading' && <span className="bookshelf__ribbon" />}
    </button>
  )
}

/**
 * "책장" 창. 서재의 책을 책장에 꽂힌 모습(책등)이나 진열대처럼 표지가 보이게(전면) 보여 줍니다.
 * 책을 누르면 서재 창에서 그 책을 엽니다.
 */
export default function BookshelfWindow({ isReady, books, onOpenLibrary, onOpenBook, onClose }) {
  const [prefs, setPrefs] = useState(readPrefs)
  const { view, sort, status } = prefs

  const updatePrefs = (patch) =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch {
        // 저장소를 못 써도 이번 창에서만 유지될 뿐입니다.
      }
      return next
    })

  // 거르기와 상관없이 서재 전체에서 시리즈를 찾아, 필터를 바꿔도 책등 모습이 그대로이게 합니다.
  const series = useMemo(() => findSeries(books), [books])
  const shelved = useMemo(
    () => books.filter((b) => status === 'all' || b.status === status).sort(SORTS[sort].compare),
    [books, sort, status],
  )

  if (!isReady) {
    return (
      <div className="bookshelf bookshelf--empty">
        <p>먼저 서재 파일을 열거나 새로 만들어야 합니다.</p>
        <button type="button" onClick={onOpenLibrary}>
          서재 열기
        </button>
      </div>
    )
  }

  const menus = [
    { label: '파일(F)', items: [{ label: '닫기', onClick: () => onClose() }] },
    {
      label: '보기(V)',
      items: [
        { label: '책등으로 꽂기', onClick: () => updatePrefs({ view: 'spine' }), checked: view === 'spine' },
        { label: '표지로 진열하기', onClick: () => updatePrefs({ view: 'front' }), checked: view === 'front' },
      ],
    },
  ]

  return (
    <div className="bookshelf">
      {onClose && <MenuBar menus={menus} />}
      <div className="bookshelf__bar">
        <span className="bookshelf__views" role="group" aria-label="보기 방식">
          <button type="button" aria-pressed={view === 'spine'} onClick={() => updatePrefs({ view: 'spine' })}>
            책등
          </button>
          <button type="button" aria-pressed={view === 'front'} onClick={() => updatePrefs({ view: 'front' })}>
            표지
          </button>
        </span>
        <label>
          상태
          <select value={status} onChange={(e) => updatePrefs({ status: e.target.value })}>
            <option value="all">전체</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          정렬
          <select value={sort} onChange={(e) => updatePrefs({ sort: e.target.value })}>
            {Object.entries(SORTS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="bookshelf__count">{shelved.length}권</span>
      </div>

      <div className="bookshelf__case">
        {shelved.length === 0 ? (
          <p className="bookshelf__empty">{books.length === 0 ? '서재에 책이 없습니다.' : '조건에 맞는 책이 없습니다.'}</p>
        ) : (
          <ul className={`bookshelf__shelf bookshelf__shelf--${view}`}>
            {shelved.map((book) => (
              <li key={book.id}>
                {view === 'spine' ? (
                  <Spine book={book} series={series.get(book.id)} onOpen={onOpenBook} />
                ) : (
                  <FrontCover book={book} series={series.get(book.id)} onOpen={onOpenBook} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
