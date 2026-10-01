import PixelIcon from './PixelIcon'

/**
 * Windows 98 탐색기식 도구 모음. 평소엔 평평하다가 마우스를 올리면 볼록 튀어나오고, 누르면 들어갑니다.
 * items: [{ icon, label, title?, onClick, disabled? } | { separator: true }]
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
            className="toolbar__button"
            title={item.title || item.label}
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
