import PixelIcon from './PixelIcon'

function formatTime(date) {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * 작업표시줄 알림 영역(시계 옆)의 서재 저장 상태. Windows 98 트레이 아이콘처럼 작게 보여 주고,
 * 자세한 설명은 마우스를 올리면 나오는 풍선 도움말(title)에 둡니다.
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
  if (!isReady) return null

  const savedText = lastSaved
    ? `${lastSaved.auto ? '자동저장됨' : '저장됨'} ${formatTime(lastSaved.at)}`
    : null
  const hint =
    !canAutoSave && (fsaSupported || driveSupported)
      ? '한 번 저장하면 변경사항이 있을 때 자동 저장됩니다'
      : null
  const tooltip = [
    isDirty ? '저장되지 않은 변경사항이 있습니다. 누르면 저장합니다.' : '저장된 상태입니다.',
    savedText && `마지막 저장: ${savedText}`,
    hint,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <button
      type="button"
      className={`taskbar__status${isDirty ? ' is-dirty' : ''}`}
      // disabled 대신 aria-disabled: 비활성 버튼은 일부 브라우저에서 풍선 도움말이 안 나옵니다.
      onClick={() => isDirty && !busy && onSave()}
      aria-disabled={busy || !isDirty}
      title={tooltip}
      aria-label={tooltip}
    >
      <PixelIcon name="floppy" />
      {isDirty ? (
        <span className="taskbar__status-dirty">● 미저장</span>
      ) : (
        savedText && <span className="taskbar__status-saved">{savedText}</span>
      )}
    </button>
  )
}
