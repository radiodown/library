import { useEffect, useRef, useState } from 'react'
import PixelIcon from './PixelIcon'

/** 시작 버튼용 4색 깃발 로고 (인라인 SVG, 16x16). */
function StartLogo() {
  return (
    <svg className="taskbar__logo" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1 2.5c1.8-.9 3.5-.9 5.5 0v4.6c-2-.9-3.7-.9-5.5 0z" fill="#e8281c" />
      <path d="M7.5 2.9c1.8.9 3.6.9 5.5 0v4.6c-1.9.9-3.7.9-5.5 0z" fill="#3cae2b" />
      <path d="M1 8.6c1.8-.9 3.5-.9 5.5 0v4.6c-2-.9-3.7-.9-5.5 0z" fill="#1f5fd6" />
      <path d="M7.5 9c1.8.9 3.6.9 5.5 0v4.6c-1.9.9-3.7.9-5.5 0z" fill="#f5c60a" />
    </svg>
  )
}

/**
 * 하단 작업 표시줄. 시작 메뉴, 열려 있는 창 목록, 시계를 보여줍니다.
 * menuItems: { icon, label, onClick } 또는 { separator: true } 배열
 * tray: 시계 왼쪽 알림 영역에 넣을 내용 (서재 저장 상태 등)
 */
export default function Taskbar({ windows, activeId, onToggle, menuItems = [], onClockEasterEgg, tray }) {
  const [now, setNow] = useState(new Date())
  const [menuOpen, setMenuOpen] = useState(false)
  const startRef = useRef(null)
  const clockClicksRef = useRef([]) // 최근 시계 클릭 시각들

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // 메뉴 바깥을 누르거나 Esc를 누르면 닫습니다.
  // (Safari는 버튼 클릭 시 포커스를 주지 않으므로 blur 대신 pointerdown을 사용)
  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (e) => {
      if (!startRef.current?.contains(e.target)) setMenuOpen(false)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="taskbar">
      <div className="taskbar__start-wrap" ref={startRef}>
        {menuOpen && (
          <div className="start-menu">
            <div className="start-menu__banner" aria-hidden="true">
              <span>
                Library<strong>98</strong>
              </span>
            </div>
            <ul className="start-menu__list" role="menu">
            {menuItems.map((item, i) =>
              item.separator ? (
                <li key={`sep-${i}`} className="start-menu__separator" role="separator" />
              ) : (
                <li key={item.label} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="start-menu__item"
                    onClick={() => {
                      setMenuOpen(false)
                      item.onClick()
                    }}
                  >
                    <span className="start-menu__icon">
                      <PixelIcon name={item.icon} size={32} />
                    </span>
                    {item.label}
                  </button>
                </li>
              ),
            )}
            </ul>
          </div>
        )}
        <button
          type="button"
          className={`taskbar__start${menuOpen ? ' is-open' : ''}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <StartLogo />
          시작
        </button>
      </div>

      <div className="taskbar__items">
        {windows
          .filter((w) => !w.dialog) // 알림창은 작업표시줄에 나타나지 않습니다
          .map((w) => (
          <button
            key={w.id}
            type="button"
            className={`taskbar__item${w.id === activeId ? ' is-active' : ''}`}
            onClick={() => onToggle(w.id)}
          >
            <PixelIcon name={w.icon} /> <span className="taskbar__title">{w.title}</span>
          </button>
        ))}
      </div>

      {tray}

      <div
        className="taskbar__clock"
        onClick={() => {
          // 3초 안에 5번 누르면 이스터에그
          const t = Date.now()
          const recent = [...clockClicksRef.current, t].filter((c) => t - c < 3000)
          if (recent.length >= 5) {
            clockClicksRef.current = []
            onClockEasterEgg?.()
          } else {
            clockClicksRef.current = recent
          }
        }}
      >
        {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}
