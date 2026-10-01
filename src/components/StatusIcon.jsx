import PixelIcon from './PixelIcon'

const STATUS = {
  wishlist: { icon: 'book-new', label: '읽고 싶음' },
  reading: { icon: 'book-marked', label: '읽는 중' },
  finished: { icon: 'book-star', label: '완독' },
}

/**
 * 책 읽기 상태를 98 탐색기처럼 작은 도트 아이콘으로 보여 줍니다. 같은 책 한 권이
 * 새 책(읽고 싶음) → 책갈피를 꽂은 책(읽는 중) → 별이 찍힌 책(완독)으로 바뀌는 모양입니다.
 * 세 그림의 책 본체가 같은 자리라 가운데 맞춤(centered)을 쓰지 않습니다.
 * withLabel이면 아이콘 옆에 상태 이름도 씁니다 (책 정보 화면). 없으면 툴팁으로만 보여 줍니다 (목록).
 */
export default function StatusIcon({ status, withLabel = false }) {
  const s = STATUS[status]
  if (!s) return null
  if (withLabel) {
    return (
      <span className="status-label">
        <PixelIcon name={s.icon} />
        {s.label}
      </span>
    )
  }
  return (
    <span className="status-icon" role="img" aria-label={s.label} title={s.label}>
      <PixelIcon name={s.icon} />
    </span>
  )
}
