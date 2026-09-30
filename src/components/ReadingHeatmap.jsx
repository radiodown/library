import { useMemo } from 'react'

const pad = (n) => String(n).padStart(2, '0')
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const level = (count) => (count <= 0 ? 0 : Math.min(count, 4))

/**
 * 한 해의 완독일을 GitHub 잔디처럼 보여 주는 캘린더 히트맵.
 * perDay: { 'YYYY-MM-DD': 그날 완독한 권수 }. 열은 주(일요일 시작), 행은 요일입니다.
 * 색은 한 가지 색의 진하기(0~4단계)로만 횟수를 나타냅니다.
 */
export default function ReadingHeatmap({ year, perDay, today }) {
  const { cells, weeks, months, daysRead, total } = useMemo(() => {
    const y = Number(year)
    const first = new Date(y, 0, 1)
    const lead = first.getDay() // 1월 1일 앞을 비우는 칸 수 (일요일 = 0)
    const list = []
    let read = 0
    let sum = 0
    const monthStarts = []
    for (let d = new Date(y, 0, 1); d.getFullYear() === y; d.setDate(d.getDate() + 1)) {
      const key = dateKey(d)
      const count = perDay[key] || 0
      if (count > 0) {
        read += 1
        sum += count
      }
      if (d.getDate() === 1) monthStarts.push({ month: d.getMonth() + 1, col: Math.floor((lead + list.length) / 7) + 1 })
      list.push({ key, count, future: key > today })
    }
    return {
      cells: list,
      weeks: Math.ceil((lead + list.length) / 7),
      months: monthStarts,
      daysRead: read,
      total: sum,
    }
  }, [year, perDay, today])

  const lead = new Date(Number(year), 0, 1).getDay()

  return (
    <div className="heatmap">
      <p className="stats__hint">
        {year}년에 완독한 날은 <strong>{daysRead}일</strong>, 완독한 책은 <strong>{total}권</strong>
        입니다. (재독 포함, 칸에 마우스를 올리면 날짜가 보입니다)
      </p>
      <div className="heatmap__scroll">
        <div className="heatmap__months" style={{ gridTemplateColumns: `repeat(${weeks}, 12px)` }} aria-hidden="true">
          {months.map((m) => (
            <span key={m.month} style={{ gridColumn: m.col }}>
              {m.month}월
            </span>
          ))}
        </div>
        <div
          className="heatmap__grid"
          role="img"
          aria-label={`${year}년 독서 캘린더: 완독한 날 ${daysRead}일, 완독한 책 ${total}권`}
          style={{ gridTemplateColumns: `repeat(${weeks}, 12px)` }}
        >
          {Array.from({ length: lead }, (_, i) => (
            <span key={`lead-${i}`} className="heatmap__cell heatmap__cell--blank" />
          ))}
          {cells.map((c) => (
            <span
              key={c.key}
              className={`heatmap__cell heatmap__cell--l${c.future ? 'f' : level(c.count)}`}
              title={c.count > 0 ? `${c.key} · ${c.count}권 완독` : c.key}
            />
          ))}
        </div>
      </div>
      <div className="heatmap__legend" aria-hidden="true">
        적음
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`heatmap__cell heatmap__cell--l${l}`} />
        ))}
        많음
      </div>
    </div>
  )
}
