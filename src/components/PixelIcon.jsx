import { ICONS, PALETTE } from '../utils/pixelIcons'

// 아이콘마다 색별로 가로 연속 픽셀을 한 사각형으로 묶은 path를 한 번만 만들어 둡니다.
const PATHS = Object.fromEntries(
  Object.entries(ICONS).map(([name, rows]) => {
    const byColor = {}
    rows.forEach((row, y) => {
      let x = 0
      while (x < row.length) {
        const ch = row[x]
        if (ch === '.') {
          x += 1
          continue
        }
        let end = x
        while (end < row.length && row[end] === ch) end += 1
        ;(byColor[ch] ||= []).push(`M${x} ${y}h${end - x}v1h-${end - x}z`)
        x = end
      }
    })
    return [
      name,
      {
        grid: rows.length, // 16 또는 32
        paths: Object.entries(byColor).map(([ch, d]) => ({ fill: PALETTE[ch], d: d.join('') })),
      },
    ]
  }),
)

/**
 * Windows 98 스타일 도트 아이콘. 정수 배로 그려야 또렷합니다. (16px 그림은 16/32/48/64px)
 * size가 32 이상이고 32x32 정밀판('이름@32')이 있으면 그것을 씁니다. 없으면 16px 그림을 키워 씁니다.
 * 실제 표시 크기는 CSS(.pixel-icon 폭/높이)가 size 속성보다 우선하므로 화면별로 CSS로 키울 수 있습니다.
 */
export default function PixelIcon({ name, size = 16, className = '' }) {
  const icon = PATHS[size >= 32 && PATHS[`${name}@32`] ? `${name}@32` : name]
  if (!icon) return null
  return (
    <svg
      className={`pixel-icon ${className}`.trim()}
      viewBox={`0 0 ${icon.grid} ${icon.grid}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {icon.paths.map((p) => (
        <path key={p.fill} fill={p.fill} d={p.d} />
      ))}
    </svg>
  )
}
