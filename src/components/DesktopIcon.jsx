import { useState } from 'react'

/** 데스크탑 위 아이콘. 한 번 클릭하면 선택(강조), 더블클릭하면 실행됩니다. */
export default function DesktopIcon({ icon, label, onActivate }) {
  const [selected, setSelected] = useState(false)

  return (
    <button
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
