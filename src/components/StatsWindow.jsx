import { useMemo, useState } from 'react'
import ReadingHeatmap from './ReadingHeatmap'
import MenuBar from './MenuBar'
import { computeStats, todayString, STALE_READING_DAYS } from '../utils/stats'

const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'volume', label: '독서량' },
  { id: 'manage', label: '관리' },
  { id: 'analysis', label: '분석' },
]

/** 세로 막대 그래프. 값은 막대 위에 숫자로도 표시합니다. */
function Bars({ items, caption }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="stats__bars" role="img" aria-label={caption}>
      {items.map((item) => (
        <div key={item.label} className="stats__bar">
          <span className="stats__bar-value">{item.value || ''}</span>
          <span className="stats__bar-fill" style={{ height: `${(item.value / max) * 100}%` }} />
          <span className="stats__bar-label">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

/** 저자/출판사 순위 칩. 누르면(onSearchBy가 있을 때) 검색 창에서 그 이름의 책을 모아 봅니다. */
function RankedNames({ kind, rows, onSearchBy }) {
  if (rows.length === 0) {
    return (
      <p className="stats__hint">
        {kind === 'author' ? '저자가 입력된 완독 책이 아직 없습니다.' : '출판사가 입력된 완독 책이 아직 없습니다. 책 정보 수정에서 도서 검색으로 채울 수 있습니다.'}
      </p>
    )
  }
  return (
    <>
      <ul className="stats__tags">
        {rows.map((r) => (
          <li key={r.name}>
            {onSearchBy ? (
              <button type="button" className="person-link" onClick={() => onSearchBy(kind, r.name)}>
                {r.name}
              </button>
            ) : (
              r.name
            )}{' '}
            <strong>{r.count}</strong>
          </li>
        ))}
      </ul>
      <p className="stats__hint">완독한 책 권수 기준이며 재독은 세지 않습니다.</p>
    </>
  )
}

function Tile({ label, value, sub }) {
  return (
    <div className="stats__tile">
      <span className="stats__tile-value">{value}</span>
      <span className="stats__tile-label">{label}</span>
      {sub && <span className="stats__tile-sub">{sub}</span>}
    </div>
  )
}

/** 관리가 필요한 책 목록 한 묶음. 비어 있으면 아무것도 그리지 않습니다. */
function AttentionGroup({ title, hint, rows }) {
  if (rows.length === 0) return null
  return (
    <details className="stats__group" open>
      <summary>
        {title} <strong>{rows.length}</strong>
      </summary>
      <p className="stats__hint">{hint}</p>
      <ul>
        {rows.map((row) => (
          <li key={row.book.id}>
            <span className="stats__book">
              <strong>{row.book.title}</strong>
              {row.book.author && <span> · {row.book.author}</span>}
              {row.note && <span className="stats__note"> ({row.note})</span>}
            </span>
            {row.action && (
              <button type="button" onClick={row.action.onClick}>
                {row.action.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

/** "독서 통계" 창의 내용. 탭으로 개요·독서량·관리·분석을 나눠 보여줍니다. */
export default function StatsWindow({
  isReady,
  books,
  readings,
  getReviewCounts,
  reviewsVersion,
  onWriteReview,
  onOpenLibrary,
  onSearchBy,
  onClose, // 데스크톱 창에서만 넘어오며, 있을 때만 메뉴바를 보여 줍니다
}) {
  const [tab, setTab] = useState('overview')
  const [pickedYear, setPickedYear] = useState(null)

  const stats = useMemo(
    () => computeStats(books, getReviewCounts(), todayString(), readings),
    // reviewsVersion: 감상문은 다른 창에서 바뀌므로 바뀔 때마다 다시 계산
    [books, readings, getReviewCounts, reviewsVersion],
  )

  if (!isReady) {
    return (
      <div className="stats stats--empty">
        <p>먼저 서재 파일을 열거나 새로 만들어야 합니다.</p>
        <button type="button" onClick={onOpenLibrary}>
          서재 열기
        </button>
      </div>
    )
  }

  const { totals, years, perMonth, perDay, ratingDist, topTags, topAuthors, topPublishers, attention } = stats

  const attentionTotal =
    attention.noReview.length +
    attention.stale.length +
    attention.noRating.length +
    attention.missingFinishDate.length +
    attention.missingStartDate.length

  // 월별 그래프에 보여 줄 연도: 직접 고른 값 > 올해 > 데이터가 있는 가장 최근 연도
  const thisYear = todayString().slice(0, 4)
  const yearOptions = [...new Set([...years.map((y) => y.year), thisYear])].sort().reverse()
  const monthYear = pickedYear && yearOptions.includes(pickedYear) ? pickedYear : yearOptions[0]
  const monthCounts = perMonth[monthYear] || Array(12).fill(0)

  const writeReview = (book) => ({ label: '감상문 쓰기', onClick: () => onWriteReview(book) })

  // 탭 키보드 조작: ←/→ 이동, Home/End 처음/끝
  const handleTabKeyDown = (e) => {
    const i = TABS.findIndex((t) => t.id === tab)
    let next = null
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    if (next === null) return
    e.preventDefault()
    setTab(TABS[next].id)
    document.getElementById(`stats-tab-${TABS[next].id}`)?.focus()
  }

  const menus = [
    { label: '파일(F)', items: [{ label: '닫기', onClick: () => onClose() }] },
    {
      label: '보기(V)',
      items: TABS.map((t) => ({
        label: `${tab === t.id ? '✓' : '\u00a0\u00a0'} ${t.label}`,
        onClick: () => setTab(t.id),
      })),
    },
  ]

  return (
    <div className="stats">
      {onClose && <MenuBar menus={menus} />}
      <div className="stats__tabs" role="tablist" onKeyDown={handleTabKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`stats-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="stats-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className={`stats__tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'manage' && attentionTotal > 0 && (
              <span className="stats__badge">{attentionTotal}</span>
            )}
          </button>
        ))}
      </div>

      <div
        className="stats__panel"
        id="stats-panel"
        role="tabpanel"
        aria-labelledby={`stats-tab-${tab}`}
      >
        {tab === 'overview' && (
          <>
            <section className="stats__tiles">
              <Tile label="전체" value={totals.all} />
              <Tile label="완독" value={totals.finished} />
              <Tile label="읽는 중" value={totals.reading} />
              <Tile label="읽고 싶음" value={totals.wishlist} />
              <Tile label="올해 완독" value={`${stats.thisYearCount}권`} sub="재독 포함" />
              <Tile label="이번 달 완독" value={`${stats.thisMonthCount}권`} sub="재독 포함" />
              <Tile label="다시 읽기" value={`${stats.rereadCount}회`} sub="완독한 재독" />
              <Tile
                label="평균 별점"
                value={stats.avgRating == null ? '-' : stats.avgRating.toFixed(1)}
              />
              <Tile
                label="독후감 작성률"
                value={stats.reviewRate == null ? '-' : `${Math.round(stats.reviewRate * 100)}%`}
                sub="완독한 책 기준"
              />
              <Tile
                label="평균 독서 기간"
                value={stats.avgReadingDays == null ? '-' : `${Math.round(stats.avgReadingDays)}일`}
                sub="시작일~완독일"
              />
            </section>

            {attentionTotal > 0 && (
              <div className="stats__callout">
                <span>
                  정리가 필요한 항목이 <strong>{attentionTotal}</strong>건 있습니다.
                </span>
                <button type="button" onClick={() => setTab('manage')}>
                  관리 탭 보기
                </button>
              </div>
            )}

            <section className="stats__section">
              <h3>최근 완독</h3>
              {stats.recentFinished.length === 0 ? (
                <p className="stats__hint">완독일이 입력된 완독 책이 아직 없습니다.</p>
              ) : (
                <ul className="stats__recent">
                  {stats.recentFinished.map((b) => (
                    <li key={b.id}>
                      <span className="stats__book">
                        <strong>{b.title}</strong>
                        {b.author && <span> · {b.author}</span>}
                      </span>
                      <span className="stats__meta">
                        {b.rating != null && `★${b.rating} · `}
                        {b.finishDate}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {tab === 'volume' && (
          <>
            <section className="stats__section">
              <h3>연도별 독서량 (재독 포함)</h3>
              {years.length === 0 ? (
                <p className="stats__hint">완독일이 입력된 완독 책이 아직 없습니다.</p>
              ) : (
                <Bars
                  caption="연도별 완독 권수"
                  items={years.map((y) => ({ label: y.year, value: y.count }))}
                />
              )}
            </section>

            <section className="stats__section">
              <h3>
                월별 독서량 (재독 포함)
                <select value={monthYear} onChange={(e) => setPickedYear(e.target.value)}>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
              </h3>
              <Bars
                caption={`${monthYear}년 월별 완독 권수`}
                items={monthCounts.map((count, i) => ({ label: `${i + 1}월`, value: count }))}
              />
            </section>

            <section className="stats__section">
              <h3>독서 캘린더 ({monthYear}년)</h3>
              <ReadingHeatmap year={monthYear} perDay={perDay} today={todayString()} />
            </section>
          </>
        )}

        {tab === 'manage' && (
          <section className="stats__section">
            {attentionTotal === 0 && <p className="stats__ok">정리할 항목이 없습니다.</p>}
            <AttentionGroup
              title="독후감이 없는 완독 책"
              hint="다 읽었지만 감상문을 쓰지 않았습니다."
              rows={attention.noReview.map((book) => ({
                book,
                action: onWriteReview ? writeReview(book) : undefined,
              }))}
            />
            <AttentionGroup
              title="오래 읽고 있는 책"
              hint={`읽기 시작한 지 ${STALE_READING_DAYS}일이 넘었습니다.`}
              rows={attention.stale.map(({ book, days }) => ({ book, note: `${days}일째` }))}
            />
            <AttentionGroup
              title="별점이 없는 완독 책"
              hint="서재에서 책을 열어 별점을 매겨 보세요."
              rows={attention.noRating.map((book) => ({ book }))}
            />
            <AttentionGroup
              title="완독일이 비어 있는 완독 책"
              hint="완독일이 없으면 연/월별 통계에 잡히지 않습니다."
              rows={attention.missingFinishDate.map((book) => ({ book }))}
            />
            <AttentionGroup
              title="시작일이 비어 있는 읽는 중 책"
              hint="시작일이 없으면 오래 읽고 있는지 알 수 없습니다."
              rows={attention.missingStartDate.map((book) => ({ book }))}
            />
          </section>
        )}

        {tab === 'analysis' && (
          <>
            <section className="stats__section">
              <h3>별점 분포</h3>
              <Bars
                caption="별점별 책 수"
                items={ratingDist.map((r) => ({ label: `★${r.rating}`, value: r.count }))}
              />
            </section>

            <section className="stats__section">
              <h3>자주 쓴 태그</h3>
              {topTags.length === 0 ? (
                <p className="stats__hint">태그가 없습니다.</p>
              ) : (
                <ul className="stats__tags">
                  {topTags.map((t) => (
                    <li key={t.tag}>
                      {t.tag} <strong>{t.count}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="stats__section">
              <h3>많이 읽은 저자</h3>
              <RankedNames kind="author" rows={topAuthors} onSearchBy={onSearchBy} />
            </section>

            <section className="stats__section">
              <h3>많이 읽은 출판사</h3>
              <RankedNames kind="publisher" rows={topPublishers} onSearchBy={onSearchBy} />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
