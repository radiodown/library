import { useCallback, useRef, useState } from 'react'

/**
 * 여러 개의 "창"을 관리하는 미니 창 관리자.
 * 창은 id로 식별되며, 같은 id로 다시 openWindow를 호출하면 새로 만들지 않고
 * 기존 창을 복원(minimized 해제)하고 맨 앞으로 가져옵니다.
 */
export function useWindowManager() {
  const [windows, setWindows] = useState([])
  const zRef = useRef(1)

  const focusWindow = useCallback((id) => {
    zRef.current += 1
    const z = zRef.current
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, zIndex: z } : w)))
  }, [])

  const openWindow = useCallback((id, config = {}) => {
    zRef.current += 1
    const z = zRef.current
    setWindows((prev) => {
      const existing = prev.find((w) => w.id === id)
      if (existing) {
        return prev.map((w) => (w.id === id ? { ...w, ...config, minimized: false, zIndex: z } : w))
      }
      return [...prev, { id, minimized: false, zIndex: z, ...config }]
    })
  }, [])

  const closeWindow = useCallback((id) => {
    setWindows((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const toggleMinimize = useCallback((id) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)))
  }, [])

  return { windows, openWindow, closeWindow, focusWindow, toggleMinimize }
}
