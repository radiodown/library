import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { lookupPrice } from '../api/kakaoBooks'
import MenuBar from './MenuBar'
import PixelIcon from './PixelIcon'
import Stars from './Stars'
import { formatWon, sumPrices } from '../utils/price'

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

/** 마우스를 올리거나 키보드로 포커스를 옮기면 정보 팝업을 띄우는 핸들러 모음. */
function infoHandlers(book, series, { onShow, onHide, onActivate }) {
  const show = (e) => onShow(book, series, e.currentTarget)
  return {
    onMouseEnter: show,
    onFocus: show,
    onMouseLeave: onHide,
    onBlur: onHide,
    onClick: (e) => onActivate(book, series, e.currentTarget),
  }
}

function Spine({ book, series, ...handlers }) {
  const { color, width, height, bands } = spineStyle(book, series)
  return (
    <button
      type="button"
      className={`bookshelf__spine bookshelf__spine--bands-${bands}`}
      style={{ width, height, background: color.bg, color: color.fg }}
      aria-label={tooltip(book)}
      {...infoHandlers(book, series, handlers)}
    >
      {book.status === 'reading' && <span className="bookshelf__ribbon" />}
      <span className="bookshelf__spine-title">{series ? series.base : book.title}</span>
      {book.author && width >= 28 && <span className="bookshelf__spine-author">{book.author}</span>}
      {series && <span className="bookshelf__spine-volume">{series.volume}</span>}
    </button>
  )
}

function FrontCover({ book, series, ...handlers }) {
  const { color } = spineStyle(book, series)
  return (
    <button
      type="button"
      className="bookshelf__front"
      aria-label={tooltip(book)}
      {...infoHandlers(book, series, handlers)}
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

/** 책값 대화상자. 다른 알림창(modal98)과 같은 Windows 98 메시지 상자 모양입니다. */
function PricePopup({ run, scopeLabel, prices, onRetry, onClose }) {
  const loading = run.status === 'loading'
  const percent = run.total ? Math.round((run.done / run.total) * 100) : 100
  const iconName = run.error ? 'warning' : loading ? 'search' : 'bookshelf'

  return (
    <div className="bookshelf__overlay" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="modal98 price-dialog" role="dialog" aria-label="책값" aria-live="polite">
        <div className="modal98__titlebar">
          <span className="modal98__title">책값 알아보기</span>
          <button type="button" className="win__control win__control--close" onClick={onClose} title="닫기">
            ✕
          </button>
        </div>
        <div className="modal98__body">
          <span className={`modal98__icon price-dialog__icon price-dialog__icon--${run.status}`}>
            <PixelIcon name={iconName} size={32} />
          </span>
          <div className="price-dialog__content">
            {loading ? (
              <>
                <p className="price-dialog__heading">가격을 찾고 있습니다</p>
                <p className="price-dialog__scope">{scopeLabel} · 카카오 도서 검색</p>
                <div className="price-dialog__bar" role="progressbar" aria-valuemin={0} aria-valuemax={run.total} aria-valuenow={run.done}>
                  <span style={{ width: `${percent}%` }} />
                </div>
                <div className="price-dialog__progress-meta">
                  <span><strong>{run.done}</strong> / {run.total}권 확인</span>
                  <span>가격 발견 {run.found}권</span>
                </div>
              </>
            ) : (
              <>
                <p className="price-dialog__scope">{scopeLabel}</p>
                <div className="price-dialog__summary">
                  <span className="price-dialog__total-label">확인된 책값</span>
                  <strong className="price-dialog__total">{formatWon(prices.total)}</strong>
                  <div className="price-dialog__stats" aria-label="가격 확인 결과">
                    <span>가격 있음 <strong>{prices.priced}권</strong></span>
                    <span>
                      {prices.missing > 0 ? <>미확인 <strong>{prices.missing}권</strong></> : <strong>모두 확인됨</strong>}
                    </span>
                  </div>
                </div>
                {run.found > 0 && (
                  <p className="price-dialog__found">
                    <span aria-hidden="true">✓</span> 새로 찾은 책 {run.found}권의 가격을 저장했습니다.
                  </p>
                )}
                {prices.missing > 0 && (
                  <p className="price-dialog__notice">
                    못 찾은 책 {prices.missing}권은 합계에서 제외했습니다. 책 정보에서 가격을 직접 적을 수 있습니다.
                  </p>
                )}
                {run.error && <p className="price-dialog__error"><strong>조회 중 문제가 생겼습니다.</strong><span>{run.error}</span></p>}
              </>
            )}
          </div>
        </div>
        <div className="modal98__buttons">
          {!loading && (prices.missing > 0 || run.error) && (
            <button type="button" className="quote-dialog__btn" onClick={onRetry}>
              다시 물어보기
            </button>
          )}
          <button type="button" className="quote-dialog__btn" onClick={onClose} autoFocus>
            {loading ? '그만하기' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}

function dateText(book) {
  if (book.dateUnknown) return '읽은 시기를 기억하지 못함'
  if (book.startDate && book.finishDate) return `${book.startDate} ~ ${book.finishDate}`
  if (book.startDate) return `${book.startDate} ~`
  if (book.finishDate) return `~ ${book.finishDate}`
  return ''
}

/**
 * 책 위(자리가 없으면 아래)에 뜨는 정보 팝업. Windows 98의 노란 풍선 도움말 모양입니다.
 * 창 안에서 잘리지 않도록 화면 기준(fixed)으로 놓고 화면 가장자리를 넘지 않게 맞춥니다.
 * 마우스에서는 클릭을 가로채지 않고, 터치에서만 "책 열기" 버튼을 보여 줍니다.
 */
function BookInfo({ info, touch, onOpen }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  const { book, series, rect } = info

  useLayoutEffect(() => {
    const box = ref.current.getBoundingClientRect()
    const gap = 8
    const margin = 8
    const above = rect.top - box.height - gap
    const top = above >= margin ? above : Math.min(rect.bottom + gap, window.innerHeight - box.height - margin)
    const left = Math.min(Math.max(margin, rect.left + rect.width / 2 - box.width / 2), window.innerWidth - box.width - margin)
    setPos({ top: Math.max(margin, top), left })
  }, [rect, info])

  const dates = dateText(book)
  const rows = [
    book.author && ['저자', book.author],
    book.translator && ['역자', book.translator],
    book.publisher && ['출판사', book.publisher],
    book.price > 0 && ['정가', formatWon(book.price)],
    dates && ['기간', dates],
  ].filter(Boolean)

  return (
    <div
      ref={ref}
      className={`bookshelf__info${touch ? ' bookshelf__info--touch' : ''}`}
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
      role="tooltip"
    >
      <strong className="bookshelf__info-title">
        {book.title}
        {series && <span> · {series.volume}</span>}
      </strong>
      <span className="bookshelf__info-status">
        <span className={`bookshelf__info-badge bookshelf__info-badge--${book.status}`}>{STATUS_LABEL[book.status]}</span>
        <Stars value={book.rating} />
      </span>
      {rows.length > 0 && (
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {touch && (
        <button type="button" onClick={() => onOpen(book.id)}>
          책 열기
        </button>
      )}
    </div>
  )
}

/**
 * "책장" 창. 서재의 책을 책장에 꽂힌 모습(책등)이나 진열대처럼 표지가 보이게(전면) 보여 줍니다.
 * 책을 누르면 서재 창에서 그 책을 엽니다.
 */
export default function BookshelfWindow({ isReady, books, fillBookPrices, onOpenLibrary, onOpenBook, onClose }) {
  const [prefs, setPrefs] = useState(readPrefs)
  const { view, sort, status } = prefs
  const [priceRun, setPriceRun] = useState(null) // 책값 팝업. null이면 닫힌 상태
  const abortRef = useRef(null)
  useEffect(() => () => abortRef.current?.abort(), [])
  const [info, setInfo] = useState(null) // { book, series, rect } 정보 팝업을 띄운 책
  const [touch, setTouch] = useState(false) // 마지막 입력이 터치면 팝업을 눌러서 열고 닫습니다
  const pointerRef = useRef('mouse')

  const showInfo = (book, series, el) => {
    // 터치에서는 포커스가 눌렀을 때 먼저 오므로, 팝업은 탭 처리(onActivate)에서만 엽니다.
    if (pointerRef.current === 'touch') return
    setInfo({ book, series, rect: el.getBoundingClientRect() })
  }
  const hideInfo = () => {
    if (pointerRef.current !== 'touch') setInfo(null)
  }
  const activate = (book, series, el) => {
    if (pointerRef.current !== 'touch') {
      onOpenBook(book.id)
      return
    }
    // 터치: 첫 탭은 정보, 같은 책을 한 번 더 탭하면 엽니다.
    if (info?.book.id === book.id) {
      onOpenBook(book.id)
      return
    }
    setInfo({ book, series, rect: el.getBoundingClientRect() })
  }
  const handlers = { onShow: showInfo, onHide: hideInfo, onActivate: activate }

  const updatePrefs = (patch) => {
    setInfo(null) // 책이 다시 그려지면 마우스가 떠났다는 신호가 오지 않을 수 있습니다.
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch {
        // 저장소를 못 써도 이번 창에서만 유지될 뿐입니다.
      }
      return next
    })
  }

  // 거르기와 상관없이 서재 전체에서 시리즈를 찾아, 필터를 바꿔도 책등 모습이 그대로이게 합니다.
  const series = useMemo(() => findSeries(books), [books])
  const shelved = useMemo(
    () => books.filter((b) => status === 'all' || b.status === status).sort(SORTS[sort].compare),
    [books, sort, status],
  )

  const prices = useMemo(() => sumPrices(shelved), [shelved])

  /**
   * 지금 책장에 보이는 책 중 가격이 비어 있는 책을 카카오에 다시 물어보고, 찾은 가격은 서재에 채웁니다.
   * 세 권씩 동시에 묻고, 팝업을 닫거나 오류가 나면 거기서 멈춥니다. 그때까지 찾은 가격은 그대로 저장합니다.
   */
  const checkPrices = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const targets = shelved.filter((book) => !(book.price > 0))
    setPriceRun({ status: targets.length ? 'loading' : 'done', done: 0, total: targets.length, found: 0, error: '' })
    if (targets.length === 0) return

    const found = []
    let done = 0
    let error = ''
    let next = 0
    const worker = async () => {
      while (!controller.signal.aborted && !error) {
        const book = targets[next++]
        if (!book) return
        try {
          const price = await lookupPrice(book, controller.signal)
          if (price) found.push([book.id, price])
        } catch (err) {
          if (err.name !== 'AbortError') error = err.message || '가격을 물어보다가 문제가 생겼어요.'
          return
        }
        done += 1
        setPriceRun((run) => run && { ...run, done, found: found.length })
      }
    }
    await Promise.all([worker(), worker(), worker()])
    fillBookPrices(found)
    if (!controller.signal.aborted) {
      setPriceRun((run) => run && { ...run, status: error ? 'error' : 'done', error, done, found: found.length })
    }
  }

  const closePriceRun = () => {
    abortRef.current?.abort()
    setPriceRun(null)
  }

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
        { separator: true },
        // 거른 상태(예: 읽고 싶음)에서는 그 책들의 책값을 알려 줍니다.
        { label: '책값 알아보기...', onClick: checkPrices, disabled: shelved.length === 0 },
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

      <div
        className="bookshelf__case"
        onPointerDownCapture={(e) => {
          const touchInput = e.pointerType === 'touch' || e.pointerType === 'pen'
          pointerRef.current = touchInput ? 'touch' : 'mouse'
          setTouch(touchInput)
          if (touchInput && !e.target.closest('button')) setInfo(null) // 빈 곳을 탭하면 팝업 닫기
        }}
        onScroll={() => setInfo(null)}
      >
        {shelved.length === 0 ? (
          <p className="bookshelf__empty">{books.length === 0 ? '서재에 책이 없습니다.' : '조건에 맞는 책이 없습니다.'}</p>
        ) : (
          <ul className={`bookshelf__shelf bookshelf__shelf--${view}`}>
            {shelved.map((book) => (
              <li key={book.id}>
                {view === 'spine' ? (
                  <Spine book={book} series={series.get(book.id)} {...handlers} />
                ) : (
                  <FrontCover book={book} series={series.get(book.id)} {...handlers} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {info && <BookInfo info={info} touch={touch} onOpen={onOpenBook} />}

      {priceRun && (
        <PricePopup
          run={priceRun}
          scopeLabel={`${status === 'all' ? '책장 전체' : STATUS_LABEL[status]} ${shelved.length}권`}
          prices={prices}
          onRetry={checkPrices}
          onClose={closePriceRun}
        />
      )}
    </div>
  )
}
