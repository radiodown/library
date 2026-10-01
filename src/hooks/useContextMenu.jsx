import { useCallback, useState } from 'react'
import ContextMenu from '../components/ContextMenu'

/**
 * 오른쪽 클릭 메뉴를 쓰는 컴포넌트용 훅.
 * open(event, items)으로 마우스 위치에 메뉴를 띄우고, 돌려준 menu를 화면 어딘가에 그려 둡니다.
 * items: [{ label, onClick, bold?, disabled? } | { separator: true }]
 */
export function useContextMenu() {
  const [state, setState] = useState(null) // { x, y, items }
  const close = useCallback(() => setState(null), [])

  const open = useCallback((e, items) => {
    e.preventDefault()
    setState({ x: e.clientX, y: e.clientY, items })
  }, [])

  const menu = state && <ContextMenu x={state.x} y={state.y} items={state.items} onClose={close} />
  return { open, menu }
}
