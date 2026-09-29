import { useEffect, useRef, useState } from 'react'
import Editor from '@toast-ui/editor'
import '@toast-ui/editor/dist/toastui-editor.css'
import ReviewViewer from './ReviewViewer'

const FORMAT_LABEL = { markdown: '마크다운', html: 'HTML', text: '일반 텍스트' }

/**
 * 감상문 작성/수정 에디터.
 * - markdown: Toast UI Editor를 마크다운 모드 + 좌우 분할 미리보기로 사용
 * - html: textarea + 옆에 실시간 렌더링 미리보기(DOMPurify 살균)
 * - text: 단순 textarea
 */
export default function ReviewEditor({ review, bookId, onSave, onCancel }) {
  const [format, setFormat] = useState(review?.format || 'markdown')
  const [content, setContent] = useState(review?.content || '')
  const editorContainerRef = useRef(null)
  const editorInstanceRef = useRef(null)

  useEffect(() => {
    if (format !== 'markdown' || !editorContainerRef.current) return

    const instance = new Editor({
      el: editorContainerRef.current,
      height: '360px',
      initialEditType: 'markdown',
      previewStyle: 'vertical', // 좌: 마크다운 작성, 우: 실시간 렌더링 미리보기
      initialValue: content,
    })
    editorInstanceRef.current = instance

    return () => {
      setContent(instance.getMarkdown())
      instance.destroy()
      editorInstanceRef.current = null
    }
    // format이 바뀔 때만 인스턴스를 새로 만들고 정리합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format])

  const handleFormatChange = (nextFormat) => {
    if (format === nextFormat) return
    if (format === 'markdown' && editorInstanceRef.current) {
      setContent(editorInstanceRef.current.getMarkdown())
    }
    setFormat(nextFormat)
  }

  const handleSave = () => {
    const finalContent =
      format === 'markdown' && editorInstanceRef.current
        ? editorInstanceRef.current.getMarkdown()
        : content

    onSave({
      id: review?.id,
      bookId,
      format,
      content: finalContent,
    })
  }

  return (
    <div className="review-editor">
      <div className="review-editor__format-tabs">
        {Object.entries(FORMAT_LABEL).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={format === key ? 'is-active' : ''}
            onClick={() => handleFormatChange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {format === 'markdown' && <div ref={editorContainerRef} />}

      {format === 'html' && (
        <div className="review-editor__split">
          <textarea
            className="review-editor__textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            placeholder="<p>HTML로 감상문을 작성하세요</p>"
          />
          <div className="review-editor__preview">
            <div className="review-editor__preview-label">미리보기</div>
            <ReviewViewer format="html" content={content} />
          </div>
        </div>
      )}

      {format === 'text' && (
        <textarea
          className="review-editor__textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={14}
          placeholder="감상문을 자유롭게 작성하세요"
        />
      )}

      <div className="review-editor__actions">
        <button onClick={handleSave}>저장</button>
        <button type="button" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  )
}
