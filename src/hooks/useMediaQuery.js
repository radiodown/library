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

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY)
}
