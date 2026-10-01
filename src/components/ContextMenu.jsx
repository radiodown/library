import { useEffect, useRef } from 'react'

/**
 * 오른쪽 클릭 메뉴. 마우스 위치(x, y)에 뜨고, 바깥을 누르거나 Esc를 누르거나 창이 흐려지면 닫힙니다.
 * items: [{ label, onClick, bold?, disabled? } | { separator: true }]
 */
export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose()
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', onClose)
    // 처음 항목에 포커스를 줘서 키보드로도 고를 수 있게 합니다.
    ref.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus()
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  const handleKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const buttons = [...ref.current.querySelectorAll('[role="menuitem"]:not(:disabled)')]
    const current = buttons.indexOf(document.activeElement)
    const next = (current + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  // 화면 오른쪽/아래 끝에서도 메뉴가 잘리지 않게 안쪽으로 당깁니다.
  const itemCount = items.filter((item) => !item.separator).length
  const left = Math.max(4, Math.min(x, window.innerWidth - 200))
  const top = Math.max(4, Math.min(y, window.innerHeight - (itemCount * 24 + 40)))

  return (
    <ul
      ref={ref}
      className="context-menu"
      role="menu"
      style={{ left, top }}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.separator ? (
          <li key={`sep-${i}`} className="context-menu__separator" role="separator" />
        ) : (
          <li key={item.label} role="none">
            <button
              type="button"
              role="menuitem"
              className={`context-menu__item menubar__item${item.bold ? ' is-bold' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                onClose()
                item.onClick()
              }}
            >
              {item.label}
            </button>
          </li>
        ),
      )}
    </ul>
  )
}
