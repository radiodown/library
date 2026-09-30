import { useEffect } from 'react'
import PixelIcon from './PixelIcon'

const DONE_VISIBLE_MS = 3000

/** Google Drive 불러오기/저장의 진행·완료·실패를 화면 오른쪽 아래에 알려 주는 상태창. */
export default function DriveStatusToast({ status, onDismiss }) {
  useEffect(() => {
    if (status?.phase !== 'done') return undefined
    const timer = setTimeout(onDismiss, DONE_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [status, onDismiss])

  if (!status) return null

  return (
    <div className={`drive-toast drive-toast--${status.phase}`} role="status" aria-live="polite">
      <div className="drive-toast__title">Google Drive</div>
      <div className="drive-toast__body">
        {status.phase === 'error' && <PixelIcon name="warning" className="pixel-icon--inline" />}
        <span>{status.phase === 'done' ? '✔ ' : ''}{status.text}</span>
      </div>
      {status.phase !== 'working' && (
        <button type="button" className="drive-toast__close" onClick={onDismiss}>
          확인
        </button>
      )}
    </div>
  )
}
