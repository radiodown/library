import { useEffect, useRef, useState } from 'react'
import PixelIcon from './PixelIcon'

// Windows 98처럼 마우스를 잠깐 올려 두면 툴팁이 뜹니다.
const TOOLTIP_DELAY = 400

function formatTime(date) {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * 작업표시줄 알림 영역(시계 왼쪽)의 서재 저장 상태 아이콘.
 * 플로피 디스크 위의 점 색으로 상태를 보여 줍니다. 빨강은 저장 안 된 변경 있음, 초록은 저장된 상태입니다.
 * 자세한 내용(마지막 저장 시각 등)은 마우스를 올리면 98식 노란 툴팁으로 보여 줍니다.
 * 저장하지 않은 변경이 있을 때 누르면 바로 저장합니다. (Ctrl+S와 같음)
 */
export default function SaveStatusTray({
  isReady,
  isDirty,
  busy,
  lastSaved,
  canAutoSave,
  fsaSupported,
  driveSupported,
  onSave,
}) {
  const [tipOpen, setTipOpen] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  if (!isReady) return null

  const showTip = () => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setTipOpen(true), TOOLTIP_DELAY)
  }
  const hideTip = () => {
    clearTimeout(timerRef.current)
    setTipOpen(false)
  }

  const lines = [
    isDirty ? '저장되지 않은 변경사항이 있습니다.' : '모든 변경사항이 저장되었습니다.',
    lastSaved
      ? `마지막 ${lastSaved.auto ? '자동 저장' : '저장'}: ${formatTime(lastSaved.at)}`
      : isDirty
        ? '서재를 연 뒤로 아직 저장하지 않았습니다.'
        : null, // 방금 연 파일은 그 자체가 저장된 상태라 따로 말하지 않습니다
    !canAutoSave && (fsaSupported || driveSupported)
      ? '한 번 저장하면 변경사항이 있을 때 자동 저장됩니다.'
      : null,
    isDirty ? '누르면 지금 저장합니다.' : null,
  ].filter(Boolean)

  return (
    <div className="tray-status" onPointerEnter={showTip} onPointerLeave={hideTip}>
      <button
        type="button"
        className="tray-status__button"
        // disabled 대신 aria-disabled: 비활성 버튼은 마우스 이벤트가 막혀 툴팁이 안 뜹니다.
        aria-disabled={busy || !isDirty}
        aria-label={lines.join(' ')}
        onClick={() => {
          hideTip()
          if (isDirty && !busy) onSave()
        }}
        onFocus={showTip}
        onBlur={hideTip}
      >
        <PixelIcon name="floppy" />
        <span className={`tray-status__dot${isDirty ? ' is-dirty' : ''}`} aria-hidden="true" />
      </button>

      {tipOpen && (
        <div className="tray-status__tip" role="tooltip">
          {lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}
