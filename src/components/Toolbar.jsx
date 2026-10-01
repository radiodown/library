import PixelIcon from './PixelIcon'

/**
 * Windows 98 탐색기식 도구 모음. 평소엔 평평하다가 마우스를 올리면 볼록 튀어나오고, 누르면 들어갑니다.
 * items: [{ icon, label, title?, onClick, disabled?, pressed? } | { separator: true }]
 * pressed가 true/false인 버튼은 켜고 끄는 버튼이며, 켜져 있으면 98식으로 눌린 채 보입니다.
 */
export default function Toolbar({ items, label = '도구 모음' }) {
  return (
    <div className="toolbar" role="toolbar" aria-label={label}>
      {items.map((item, i) =>
        item.separator ? (
          <span key={`sep-${i}`} className="toolbar__separator" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            className={`toolbar__button${item.pressed ? ' is-pressed' : ''}`}
            title={item.title || item.label}
            aria-pressed={item.pressed}
            disabled={item.disabled}
            onClick={item.onClick}
          >
            <PixelIcon name={item.icon} centered />
            <span className="toolbar__label">{item.label}</span>
          </button>
        ),
      )}
    </div>
  )
}
