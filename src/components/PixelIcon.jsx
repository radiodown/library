import { ICONS, PALETTE } from '../utils/pixelIcons'
import { useTheme } from '../hooks/useTheme'
import ModernIcon from './ModernIcon'

// 아이콘마다 색별로 가로 연속 픽셀을 한 사각형으로 묶은 path를 한 번만 만들어 둡니다.
const PATHS = Object.fromEntries(
  Object.entries(ICONS).map(([name, rows]) => {
    const byColor = {}
    // 실제로 그려진 영역 (가운데 맞춤용)
    let minX = Infinity
    let maxX = -1
    let minY = Infinity
    let maxY = -1
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
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, end - 1)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
        ;(byColor[ch] ||= []).push(`M${x} ${y}h${end - x}v1h-${end - x}z`)
        x = end
      }
    })
    return [
      name,
      {
        grid: rows.length, // 16 또는 32
        // 그림을 칸 가운데로 옮기는 정수 픽셀 이동량 (소수면 흐려지므로 반올림)
        shift: {
          x: Math.round((rows.length - 1 - maxX - minX) / 2),
          y: Math.round((rows.length - 1 - maxY - minY) / 2),
        },
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
export default function PixelIcon({ name, size = 16, className = '', centered = false }) {
  const theme = useTheme()
  if (theme === 'liquid' || name === 'palette') return <ModernIcon name={name} size={size} className={className} />
  const icon = PATHS[size >= 32 && PATHS[`${name}@32`] ? `${name}@32` : name]
  if (!icon) return null
  return (
    <svg
      className={`pixel-icon ${className}`.trim()}
      // centered: 도구 모음처럼 아이콘을 나란히 놓을 때, 그림이 한쪽에 치우친 아이콘도 칸 가운데에 오게 합니다
      viewBox={
        centered
          ? `${-icon.shift.x} ${-icon.shift.y} ${icon.grid} ${icon.grid}`
          : `0 0 ${icon.grid} ${icon.grid}`
      }
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
