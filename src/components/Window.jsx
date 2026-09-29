import { useRef, useState } from 'react'

const MIN_WIDTH = 360
const MIN_HEIGHT = 220

/**
 * 진짜 데스크탑 프로그램처럼 드래그로 움직이고, 크기를 늘리고 줄이고, 최소화/닫기가 되는 창 프레임.
 * 위치·크기 상태는 이 컴포넌트 안에서만 관리합니다(다른 곳에서 알 필요 없음) —
 * 그래야 부모가 리렌더링돼도 사용자가 조절한 크기가 초기값으로 되돌아가지 않습니다.
 */
export default function Window({
  title,
  icon,
  zIndex,
  initialPosition = { x: 80, y: 60 },
  initialSize = { width: 720, height: 480 },
  minimized = false,
  onClose,
  onMinimize,
  onFocus,
  children,
}) {
  const [pos, setPos] = useState(initialPosition)
  const [size, setSize] = useState(initialSize)
  const dragRef = useRef(null)
  const resizeRef = useRef(null)

  const handleDragMove = (e) => {
    const drag = dragRef.current
    if (!drag) return
    setPos({ x: drag.originX + (e.clientX - drag.startX), y: drag.originY + (e.clientY - drag.startY) })
  }

  const handleDragUp = () => {
    dragRef.current = null
    window.removeEventListener('pointermove', handleDragMove)
    window.removeEventListener('pointerup', handleDragUp)
  }

  const handleTitlePointerDown = (e) => {
    onFocus()
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y }
    window.addEventListener('pointermove', handleDragMove)
    window.addEventListener('pointerup', handleDragUp)
  }

  const handleResizeMove = (e) => {
    const r = resizeRef.current
    if (!r) return
    setSize({
      width: Math.max(MIN_WIDTH, r.originWidth + (e.clientX - r.startX)),
      height: Math.max(MIN_HEIGHT, r.originHeight + (e.clientY - r.startY)),
    })
  }

  const handleResizeUp = () => {
    resizeRef.current = null
    window.removeEventListener('pointermove', handleResizeMove)
    window.removeEventListener('pointerup', handleResizeUp)
  }

  const handleResizePointerDown = (e) => {
    e.stopPropagation()
    onFocus()
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originWidth: size.width,
      originHeight: size.height,
    }
    window.addEventListener('pointermove', handleResizeMove)
    window.addEventListener('pointerup', handleResizeUp)
  }

  return (
    <div
      className={`win${minimized ? ' win--minimized' : ''}`}
      style={{ left: pos.x, top: pos.y, width: size.width, height: size.height, zIndex }}
      onPointerDownCapture={onFocus}
    >
      <div className="win__titlebar" onPointerDown={handleTitlePointerDown}>
        <span className="win__icon">{icon}</span>
        <span className="win__title">{title}</span>
        <div className="win__controls">
          <button
            type="button"
            className="win__control"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onMinimize}
            title="최소화"
          >
            _
          </button>
          <button
            type="button"
            className="win__control win__control--close"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            title="닫기"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="win__body">{children}</div>
      <div
        className="win__resize-handle"
        onPointerDown={handleResizePointerDown}
        title="크기 조절"
      />
    </div>
  )
}
