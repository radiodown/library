/**
 * 별점 표시 (0.5 단위). 4.5면 ★★★★ 뒤에 반 별을 그립니다.
 * 빈 별은 그리지 않아 예전처럼 채운 별만 보입니다.
 */
export default function Stars({ value, className = '' }) {
  if (!value) return null
  const full = Math.floor(value)
  const half = value - full >= 0.5
  return (
    <span className={`stars ${className}`.trim()} role="img" aria-label={`별점 ${value}점`} title={`${value}점`}>
      {'★'.repeat(full)}
      {half && (
        // 반 별: 옅은 빈 별 위에 같은 색 별의 왼쪽 절반을 겹칩니다
        <span className="stars__half" aria-hidden="true">
          <span className="stars__half-empty">★</span>
          <span className="stars__half-fill">★</span>
        </span>
      )}
    </span>
  )
}
