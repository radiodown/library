import { setTheme, useTheme } from '../hooks/useTheme'

const OPTIONS = [
  { id: 'classic', name: '클래식', description: '익숙한 Windows 98 스타일' },
  { id: 'liquid', name: 'Liquid Glass', description: '빛과 색이 은은하게 비치는 유리' },
]

export default function ThemePicker() {
  const theme = useTheme()
  return (
    <div className="theme-picker">
      <p className="theme-picker__intro">서재의 분위기를 골라보세요.</p>
      <div className="theme-picker__options" role="group" aria-label="화면 테마 선택">
        {OPTIONS.map((option) => (
          <button key={option.id} type="button" className={`theme-picker__option${theme === option.id ? ' is-selected' : ''}`}
            aria-pressed={theme === option.id} onClick={() => setTheme(option.id)}>
            <span className={`theme-preview theme-preview--${option.id}`} aria-hidden="true">
              <span className="theme-preview__window"><span className="theme-preview__bar" /><span className="theme-preview__lines" /></span>
              <span className="theme-preview__dock" />
            </span>
            <span className="theme-picker__name">{option.name}<span className="theme-picker__check" aria-hidden="true">{theme === option.id ? '✓' : ''}</span></span>
            <span className="theme-picker__description">{option.description}</span>
          </button>
        ))}
      </div>
      <p className="theme-picker__status" role="status">{theme === 'liquid' ? 'Liquid Glass' : '클래식'} 테마를 사용 중입니다.</p>
      <p className="theme-picker__hint">선택한 테마는 다음에 방문해도 유지됩니다.</p>
    </div>
  )
}
