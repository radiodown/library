import { useEffect, useRef, useState } from 'react'

/**
 * Windows 98 프로그램 위쪽의 "파일 편집 보기 도움말" 메뉴 줄.
 * menus: [{ label, items: [{ label, onClick, shortcut?, disabled? } | { separator: true }] }]
 * 마우스: 누르면 열리고, 하나가 열려 있으면 다른 메뉴 위에 올리기만 해도 바뀝니다.
 * 키보드: ←/→로 메뉴 사이, ↑/↓로 항목 사이를 이동하고 Enter로 실행, Esc로 닫습니다.
 */
export default function MenuBar({ menus }) {
  const [openIndex, setOpenIndex] = useState(null)
  const rootRef = useRef(null)

  // 메뉴 바깥을 누르거나 Esc를 누르면 닫습니다. (Safari는 버튼 클릭에 포커스를 주지 않아 pointerdown을 씁니다)
  useEffect(() => {
    if (openIndex === null) return undefined
    const handlePointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpenIndex(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openIndex])

  const focusItem = (menuIndex, offset) => {
    const items = [...rootRef.current.querySelectorAll(`[data-menu="${menuIndex}"] [role="menuitem"]:not(:disabled)`)]
    if (items.length === 0) return
    const current = items.indexOf(document.activeElement)
    const next = current === -1 ? (offset > 0 ? 0 : items.length - 1) : (current + offset + items.length) % items.length
    items[next].focus()
  }

  const handleKeyDown = (e) => {
    if (openIndex === null) return
    if (e.key === 'Escape') {
      e.preventDefault()
      rootRef.current.querySelector(`[data-top="${openIndex}"]`)?.focus()
      setOpenIndex(null)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const next = (openIndex + (e.key === 'ArrowRight' ? 1 : -1) + menus.length) % menus.length
      setOpenIndex(next)
      rootRef.current.querySelector(`[data-top="${next}"]`)?.focus()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      focusItem(openIndex, e.key === 'ArrowDown' ? 1 : -1)
    }
  }

  return (
    <div className="menubar" role="menubar" ref={rootRef} onKeyDown={handleKeyDown}>
      {menus.map((menu, mi) => (
        <div key={menu.label} className="menubar__menu" data-menu={mi}>
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openIndex === mi}
            data-top={mi}
            className={`menubar__top${openIndex === mi ? ' is-open' : ''}`}
            onClick={() => setOpenIndex(openIndex === mi ? null : mi)}
            onMouseEnter={() => openIndex !== null && setOpenIndex(mi)}
          >
            {menu.label}
          </button>
          {openIndex === mi && (
            <ul className="context-menu menubar__dropdown" role="menu">
              {menu.items.map((item, i) =>
                item.separator ? (
                  <li key={`sep-${i}`} className="context-menu__separator" role="separator" />
                ) : (
                  <li key={item.label} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="context-menu__item menubar__item"
                      disabled={item.disabled}
                      onClick={() => {
                        setOpenIndex(null)
                        item.onClick()
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="menubar__shortcut">{item.shortcut}</span>}
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
