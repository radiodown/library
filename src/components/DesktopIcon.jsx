import { useEffect, useRef, useState } from 'react'

/** 데스크탑 위 아이콘. 한 번 클릭하면 선택(강조), 더블클릭하면 실행됩니다. */
export default function DesktopIcon({ icon, label, onActivate }) {
  const [selected, setSelected] = useState(false)
  const ref = useRef(null)

  // Safari는 버튼 클릭 시 포커스를 주지 않아 onBlur가 동작하지 않으므로,
  // 아이콘 바깥을 누르면 선택을 해제합니다.
  useEffect(() => {
    if (!selected) return
    const handlePointerDown = (e) => {
      if (!ref.current?.contains(e.target)) setSelected(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [selected])

  return (
    <button
      ref={ref}
      type="button"
      className={`desktop-icon${selected ? ' is-selected' : ''}`}
      onClick={() => setSelected(true)}
      onDoubleClick={() => {
        setSelected(true)
        onActivate()
      }}
      onBlur={() => setSelected(false)}
    >
      <span className="desktop-icon__glyph">{icon}</span>
      <span className="desktop-icon__label">{label}</span>
    </button>
  )
}
