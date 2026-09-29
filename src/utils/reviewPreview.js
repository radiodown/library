const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

/**
 * 목록에 보여 줄 감상문 미리보기. markdown/html의 서식 기호를 걷어 낸 한 줄짜리 평문을 반환합니다.
 * 화면에는 텍스트 노드로만 넣으므로 태그가 남아도 실행되지 않지만, 읽기 좋게 최대한 지웁니다.
 */
export function toPreviewText(format, content, max = 240) {
  let text = content || ''

  if (format === 'html') {
    text = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')
  } else if (format === 'markdown') {
    text = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
      .replace(/[*_`~]/g, '')
  }

  text = text
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m])
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return '(내용 없음)'
  return text.length > max ? `${text.slice(0, max)}…` : text
}
