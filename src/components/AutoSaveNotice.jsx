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
 * 파일 덮어쓰기를 못 하는 브라우저에서 서재 창 맨 아래에 한 번 보여 주는 자동 저장 안내.
 * (저장 상태 자체는 작업표시줄 알림 영역의 SaveStatusTray에 있습니다)
 */
export default function AutoSaveNotice({ fsaSupported }) {
  const [dismissed, setDismissed] = useState(readDismissed)

  if (fsaSupported || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(NOTICE_DISMISSED_KEY, '1')
    } catch {
      // 저장할 수 없어도 이번 세션에서는 숨깁니다.
    }
  }

  return (
    <p className="save-status__notice">
      이 브라우저는 파일 자동 덮어쓰기를 지원하지 않아 자동 저장도 쓸 수 없습니다. Ctrl+S(⌘S)나
      파일 메뉴의 "저장"을 누르면 새 파일이 다운로드되니, 기존 파일 위치에 수동으로 옮겨 덮어써 주세요.
      (Chrome/Edge에서는 자동으로 덮어쓰고 변경사항이 있을 때 1분마다 자동 저장합니다.){' '}
      <button type="button" onClick={dismiss}>
        다시 보지 않기
      </button>
    </p>
  )
}
