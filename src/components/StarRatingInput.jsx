import { useState } from 'react'

const STEPS = [1, 2, 3, 4, 5]

/**
 * 별 다섯 개를 눌러 고르는 별점 입력 (0.5 단위).
 * 별의 왼쪽 절반을 누르면 반 별, 오른쪽 절반을 누르면 온 별입니다. 마우스를 올리면 미리 보여 줍니다.
 * 키보드: ←/→ 0.5씩, Home/End 0.5/5, Delete/Backspace 지우기.
 * value: number | null, onChange(number | null)
 */
export default function StarRatingInput({ value, onChange, label = '별점' }) {
  const [hover, setHover] = useState(null)
  const shown = hover ?? value ?? 0

  const valueAt = (e, n) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientX - rect.left < rect.width / 2 ? n - 0.5 : n
  }

  const handleKeyDown = (e) => {
    const current = value ?? 0
    let next
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, current + 0.5)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = current <= 0.5 ? null : current - 0.5
    else if (e.key === 'Home') next = 0.5
    else if (e.key === 'End') next = 5
    else if (e.key === 'Delete' || e.key === 'Backspace') next = null
    else return
    e.preventDefault()
    onChange(next)
  }

  return (
    <span className="star-input">
      <span
        className="star-input__stars"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0.5}
        aria-valuemax={5}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value ? `${value}점` : '별점 없음'}
        onKeyDown={handleKeyDown}
        onMouseLeave={() => setHover(null)}
      >
        {STEPS.map((n) => (
          <span
            key={n}
            className={`star-input__star${shown >= n ? ' is-full' : shown >= n - 0.5 ? ' is-half' : ''}`}
            onMouseMove={(e) => setHover(valueAt(e, n))}
            // 지금 값과 같은 곳을 다시 누르면 지웁니다
            onClick={(e) => {
              const v = valueAt(e, n)
              onChange(v === value ? null : v)
            }}
          >
            ★
          </span>
        ))}
      </span>
      <span className="star-input__value">{shown ? `${shown}점` : '없음'}</span>
      {value != null && (
        <button type="button" className="star-input__clear" onClick={() => onChange(null)} title="별점 지우기">
          지우기
        </button>
      )}
    </span>
  )
}
