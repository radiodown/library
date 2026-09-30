import { useEffect, useRef, useState } from 'react'
import PixelIcon from './PixelIcon'

/**
 * 데스크탑 위 아이콘. 한 번 클릭하면 선택(강조), 더블클릭하면 실행됩니다.
 * contextItems가 있으면 오른쪽 클릭으로 메뉴를 엽니다. [{ label, onClick, bold }] 또는 { separator: true }
 */
export default function DesktopIcon({ icon, label, onActivate, tapToOpen = false, contextItems }) {
  const [selected, setSelected] = useState(false)
  const [menu, setMenu] = useState(null) // { x, y }
  const ref = useRef(null)
  const menuRef = useRef(null)

  // Safari는 버튼 클릭 시 포커스를 주지 않아 onBlur가 동작하지 않으므로,
  // 아이콘 바깥을 누르면 선택을 해제합니다.
  useEffect(() => {
    if (!selected) return
    const handlePointerDown = (e) => {
      if (!ref.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setSelected(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [selected])

  // 메뉴 바깥을 누르거나 Esc를 누르면 닫습니다.
  useEffect(() => {
    if (!menu) return undefined
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(null)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenu(null)
    }
    const handleBlur = () => setMenu(null)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleBlur)
    }
  }, [menu])

  const handleContextMenu = (e) => {
    if (!contextItems) return
    e.preventDefault()
    setSelected(true)
    // 키보드(메뉴 키)로 열면 좌표가 0이므로 아이콘 위치를 씁니다.
    const rect = ref.current.getBoundingClientRect()
    const fromKeyboard = e.clientX === 0 && e.clientY === 0
    setMenu({ x: fromKeyboard ? rect.left : e.clientX, y: fromKeyboard ? rect.bottom : e.clientY })
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`desktop-icon${selected ? ' is-selected' : ''}`}
        onClick={() => (tapToOpen ? onActivate() : setSelected(true))}
        onDoubleClick={
          tapToOpen
            ? undefined
            : () => {
                setSelected(true)
                onActivate()
              }
        }
        onContextMenu={handleContextMenu}
        onBlur={() => !menu && setSelected(false)}
      >
        <span className="desktop-icon__glyph">
          <PixelIcon name={icon} size={32} />
        </span>
        <span className="desktop-icon__label">{label}</span>
      </button>

      {menu && (
        <ul
          ref={menuRef}
          className="context-menu"
          role="menu"
          style={{
            left: Math.min(menu.x, window.innerWidth - 160),
            top: Math.min(menu.y, window.innerHeight - 100),
          }}
        >
          {contextItems.map((item, i) =>
            item.separator ? (
              <li key={`sep-${i}`} className="context-menu__separator" role="separator" />
            ) : (
              <li key={item.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`context-menu__item${item.bold ? ' is-bold' : ''}`}
                  onClick={() => {
                    setMenu(null)
                    item.onClick()
                  }}
                >
                  {item.label}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </>
  )
}
