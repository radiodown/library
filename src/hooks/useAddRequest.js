import { useEffect, useRef, useState } from 'react'

/**
 * 도구 모음/메뉴의 "추가" 요청을 받는 섹션용 훅.
 * request(번호)가 새 값으로 바뀔 때마다 onRequest를 한 번 부르고,
 * 화면이 그려진 뒤 섹션을 따로 스크롤되는 칸(책 정보 칸)의 맨 위로 부드럽게 가져옵니다.
 * 돌려준 ref를 섹션의 바깥 요소에 붙입니다.
 */
export function useAddRequest(request, onRequest) {
  const sectionRef = useRef(null)
  const [seen, setSeen] = useState(null)

  // 렌더 중에 이전 값과 비교하는 React 권장 방식
  if (request != null && request !== seen) {
    setSeen(request)
    onRequest()
  }

  // seen은 새 요청을 받았을 때만 바뀌므로, 그때마다 한 번 스크롤합니다.
  useEffect(() => {
    if (seen == null) return
    const section = sectionRef.current
    const pane = section?.closest('.app__detail')
    if (!pane) return
    const top = section.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - 8
    pane.scrollTo({ top, behavior: 'smooth' })
  }, [seen])

  return sectionRef
}
