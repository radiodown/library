import { useState } from 'react'

const NOTICE_DISMISSED_KEY = 'library:autosave-notice-dismissed'

function readDismissed() {
  try {
    return localStorage.getItem(NOTICE_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 서재 창 맨 아래의 상태 표시줄. 저장하지 않은 변경, 마지막 저장 시각, 자동 저장 안내를 보여 줍니다.
 * (저장/열기 동작은 메뉴바의 "파일" 메뉴와 Ctrl+S에 있습니다)
 */
export default function SaveStatusBar({ isReady, isDirty, lastSaved, canAutoSave, fsaSupported, driveSupported }) {
  const [noticeDismissed, setNoticeDismissed] = useState(readDismissed)

  const dismissNotice = () => {
    setNoticeDismissed(true)
    try {
      localStorage.setItem(NOTICE_DISMISSED_KEY, '1')
    } catch {
      // 저장할 수 없어도 이번 세션에서는 숨깁니다.
    }
  }

  const savedText = lastSaved
    ? `${lastSaved.auto ? '자동저장됨' : '저장됨'} ${lastSaved.at.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    : null

  return (
    <div className="save-status">
      {!fsaSupported && !noticeDismissed && (
        <p className="save-status__notice">
          이 브라우저는 파일 자동 덮어쓰기를 지원하지 않아 자동 저장도 쓸 수 없습니다. Ctrl+S(⌘S)나
          파일 메뉴의 "저장"을 누르면 새 파일이 다운로드되니, 기존 파일 위치에 수동으로 옮겨 덮어써 주세요.
          (Chrome/Edge에서는 자동으로 덮어쓰고 변경사항이 있을 때 1분마다 자동 저장합니다.){' '}
          <button type="button" onClick={dismissNotice}>
            다시 보지 않기
          </button>
        </p>
      )}

      <div className="save-status__bar" role="status">
        {!isReady && <span>서재 파일을 열거나 새로 만들어 시작하세요.</span>}
        {isReady && isDirty && (
          <span className="save-status__dirty" title="저장되지 않은 변경사항이 있습니다">
            ● 미저장
          </span>
        )}
        {isReady && savedText && <span className="save-status__saved">{savedText}</span>}
        {isReady && !canAutoSave && (fsaSupported || driveSupported) && (
          <span className="save-status__hint">한 번 저장하면 변경사항이 있을 때 자동 저장됩니다</span>
        )}
        {isReady && !isDirty && !savedText && canAutoSave && <span>준비</span>}
      </div>
    </div>
  )
}
