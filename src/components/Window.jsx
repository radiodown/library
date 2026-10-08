import { useRef, useState } from 'react'
import PixelIcon from './PixelIcon'
import GlassBackdrop from './GlassBackdrop'

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
  maximized: maximizedProp = false, // 모바일: 화면(작업표시줄 위)을 꽉 채우고 드래그/크기 조절 없음
  active = true, // 맨 앞(포커스) 창만 파란 제목 줄, 나머지는 회색 (Windows 98처럼)
  dialog = false, // Windows 98 알림창처럼 작은 팝업: 최소화/크기 조절 없이 닫기만 있고, 모바일에서도 전체 화면이 되지 않음
  onClose,
  onMinimize,
  onFocus,
  children,
}) {
  const maximized = maximizedProp && !dialog
  const [pos, setPos] = useState(initialPosition)
  const [size, setSize] = useState(initialSize)
  const [zoomed, setZoomed] = useState(false) // 최대화 (복원하면 위치와 크기가 그대로 돌아옵니다)
  const isZoomed = zoomed && !maximized && !dialog
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
    if (maximized || isZoomed) return
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
      className={`win${minimized ? ' win--minimized' : ''}${maximized ? ' win--maximized' : ''}${isZoomed ? ' win--zoomed' : ''}${dialog ? ' win--dialog' : ''}${active ? '' : ' win--inactive'}`}
      style={
        maximized || isZoomed
          ? { zIndex }
          : {
              left: pos.x,
              top: pos.y,
              width: size.width,
              height: dialog ? 'auto' : size.height, // 대화상자는 내용 높이에 맞춥니다
              zIndex,
            }
      }
      onPointerDownCapture={onFocus}
      role={dialog ? 'dialog' : undefined}
      aria-label={dialog ? title : undefined}
    >
      <div
        className="win__titlebar"
        onPointerDown={handleTitlePointerDown}
        onDoubleClick={() => !maximized && !dialog && setZoomed((z) => !z)}
      >
        <GlassBackdrop radius={18} />
        <span className="win__icon">
          <PixelIcon name={icon} />
        </span>
        <span className="win__title">{title}</span>
        <div className="win__controls" onDoubleClick={(e) => e.stopPropagation()}>
          {!dialog && (
            <button
              type="button"
              className="win__control"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onMinimize}
              title="최소화"
            >
              _
            </button>
          )}
          {!dialog && !maximized && (
            <button
              type="button"
              className="win__control"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setZoomed((z) => !z)}
              title={isZoomed ? '이전 크기로' : '최대화'}
              aria-label={isZoomed ? '이전 크기로' : '최대화'}
            >
              {isZoomed ? '❐' : '□'}
            </button>
          )}
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
      {!maximized && !dialog && !isZoomed && (
        <div
          className="win__resize-handle"
          onPointerDown={handleResizePointerDown}
          title="크기 조절"
        />
      )}
    </div>
  )
}
