import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * 감상문을 형식에 맞게 렌더링합니다.
 * markdown/html 모두 DOMPurify로 살균한 뒤 삽입해 XSS를 방지합니다.
 */
export default function ReviewViewer({ format, content }) {
  const safeHtml = useMemo(() => {
    if (format === 'markdown') {
      return DOMPurify.sanitize(marked.parse(content || ''))
    }
    if (format === 'html') {
      return DOMPurify.sanitize(content || '')
    }
    return null
  }, [format, content])

  if (format === 'text') {
    return <pre className="review-viewer review-viewer--text">{content}</pre>
  }

  return <div className="review-viewer" dangerouslySetInnerHTML={{ __html: safeHtml }} />
}
