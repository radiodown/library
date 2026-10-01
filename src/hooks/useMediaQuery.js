import { useCallback, useSyncExternalStore } from 'react'

/**
 * 모바일 화면으로 볼 조건.
 * - 폭 820px 이하(폰, 세로 태블릿)
 * - 터치가 주 입력이면서 폭 1024px 이하(가로로 든 폰/태블릿)
 * 창/작업표시줄 기반 데스크탑 화면은 이 크기에서 쓰기 어렵습니다.
 */
export const MOBILE_QUERY = '(max-width: 820px), (pointer: coarse) and (max-width: 1024px)'

/** CSS 미디어 쿼리의 일치 여부를 구독합니다. 창 크기를 바꾸면 바로 반영됩니다. */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

// ---- PC 화면 모드 ----
// 모바일에서도 PC용 데스크탑 화면을 쓰고 싶을 때 켭니다. 브라우저의 "데스크톱 사이트 요청"처럼
// 뷰포트를 PC 폭으로 넓혀 화면 전체를 축소해 보여 줍니다. 설정은 브라우저에 기억합니다.
const DESKTOP_MODE_KEY = 'library98-desktop-mode'
const DESKTOP_VIEWPORT_WIDTH = 1280
const DEFAULT_VIEWPORT = 'width=device-width, initial-scale=1.0, viewport-fit=cover'

function readDesktopMode() {
  try {
    return localStorage.getItem(DESKTOP_MODE_KEY) === '1'
  } catch {
    return false
  }
}

let desktopMode = readDesktopMode()
const listeners = new Set()

function applyViewport() {
  const meta = document.querySelector('meta[name="viewport"]')
  if (!meta) return
  meta.setAttribute(
    'content',
    desktopMode ? `width=${DESKTOP_VIEWPORT_WIDTH}, viewport-fit=cover` : DEFAULT_VIEWPORT,
  )
}

// 첫 렌더 전에 뷰포트를 맞춰 두어야 모바일 화면이 잠깐 보였다가 바뀌지 않습니다.
if (typeof document !== 'undefined') applyViewport()

export function setDesktopMode(on) {
  desktopMode = on
  try {
    if (on) localStorage.setItem(DESKTOP_MODE_KEY, '1')
    else localStorage.removeItem(DESKTOP_MODE_KEY)
  } catch {
    // 저장소를 못 써도 이번 탭에서는 전환됩니다.
  }
  applyViewport()
  listeners.forEach((fn) => fn())
}

function subscribeDesktopMode(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useDesktopMode() {
  return useSyncExternalStore(subscribeDesktopMode, () => desktopMode, () => false)
}

/** PC 화면 모드가 켜져 있으면 모바일 기기여도 데스크탑 화면을 씁니다. */
export function useIsMobile() {
  const matches = useMediaQuery(MOBILE_QUERY)
  const desktop = useDesktopMode()
  return matches && !desktop
}
