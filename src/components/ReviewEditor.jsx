import { useEffect, useRef, useState } from 'react'
import Editor from '@toast-ui/editor'
import '@toast-ui/editor/dist/toastui-editor.css'
import ReviewViewer from './ReviewViewer'
import { useDialog } from './dialogContext'
import { readReviewDraft, sameReview, writeReviewDraft } from '../utils/reviewDrafts'

const TEMPLATE = '## 읽기 전의 기대\n\n\n## 기억에 남는 장면과 문장\n\n\n## 읽고 나서 달라진 생각\n\n'
const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** 초안은 브라우저에, 저장 버튼은 열린 서재에 반영합니다. 파일 저장은 별도입니다. */
export default function ReviewEditor({ review, bookId, draftKey, savedDraftKey, quotes = [], onSave, onClose, registerEditor }) {
  const dialog = useDialog()
  const [initial] = useState(() => {
    const draft = readReviewDraft(draftKey)
    // 서재와 내용이 다르면 사용자가 복구 여부를 선택합니다. 오래된 사본을 조용히 덮어쓰지 않습니다.
    const current = { title: review?.title || '', format: review?.format || 'markdown', content: review?.content || '' }
    return { draft: draft && !sameReview(draft, current) ? draft : null, value: current }
  })
  const [recovery, setRecovery] = useState(initial.draft)
  const [value, setValue] = useState(initial.value)
  const valueRef = useRef(initial.value)
  const savedRef = useRef(review || { title: '', format: 'markdown', content: '' })
  const reviewIdRef = useRef(review?.id)
  const reviewCreatedAtRef = useRef(review?.createdAt)
  const keyRef = useRef(draftKey)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(!sameReview(initial.value, review))
  const [draftStatus, setDraftStatus] = useState('작성하면 이 브라우저에 초안을 보관합니다.')
  const [error, setError] = useState('')
  const [showQuotes, setShowQuotes] = useState(false)
  const [preview, setPreview] = useState(false)
  const [mode, setMode] = useState('wysiwyg')
  const hostRef = useRef(null)
  const editorRef = useRef(null)
  const changedRef = useRef(false)

  const retain = (next) => {
    try {
      writeReviewDraft(keyRef.current, { ...next, reviewId: reviewIdRef.current, reviewCreatedAt: reviewCreatedAtRef.current })
      setDraftStatus('이 브라우저에 초안 보관됨')
      return true
    } catch {
      setDraftStatus('초안 보관 실패 — 창을 닫기 전에 서재에 저장해 주세요.')
      return false
    }
  }

  const update = (patch) => {
    const next = { ...valueRef.current, ...patch }
    valueRef.current = next
    changedRef.current = true
    setValue(next)
    setDirty(!sameReview(next, savedRef.current))
    setSaved(false)
  }

  const updateRef = useRef(update)
  useEffect(() => { updateRef.current = update })
  useEffect(() => {
    if (value.format !== 'markdown' || !hostRef.current) return
    const instance = new Editor({
      el: hostRef.current,
      height: '100%',
      minHeight: '240px',
      initialEditType: 'wysiwyg',
      previewStyle: 'tab',
      initialValue: valueRef.current.content,
      usageStatistics: false,
      placeholder: '이 책을 읽고 어떤 생각이 들었나요?',
      toolbarItems: [['heading', 'bold', 'italic', 'strike'], ['quote', 'ul', 'ol'], ['link', 'hr']],
    })
    instance.on('change', () => updateRef.current({ content: instance.getMarkdown() }))
    editorRef.current = instance
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height > 0) instance.setHeight(Math.max(240, entry.contentRect.height) + 'px')
    })
    observer.observe(hostRef.current.parentElement)
    return () => {
      observer.disconnect()
      instance.destroy()
      editorRef.current = null
    }
  }, [value.format])

  const retainRef = useRef(retain)
  useEffect(() => { retainRef.current = retain })
  useEffect(() => {
    if (!changedRef.current) return
    const timer = setTimeout(() => retainRef.current(valueRef.current), 400)
    return () => clearTimeout(timer)
  }, [value])

  useEffect(() => {
    const flush = () => { if (changedRef.current) retainRef.current(valueRef.current) }
    const beforeUnload = (event) => {
      flush()
      if (!sameReview(valueRef.current, savedRef.current)) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    const visibility = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      flush()
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  const save = () => {
    if (recovery) return false
    const next = valueRef.current
    if (!next.content.trim()) {
      setError('감상문 본문을 입력해 주세요.')
      return false
    }
    try {
      const result = onSave({ id: reviewIdRef.current, bookId, title: next.title.trim(), format: next.format, content: next.content })
      if (!result?.id) throw new Error('서재에 반영하지 못했습니다. 초안은 유지됩니다.')
      reviewIdRef.current = result.id
      reviewCreatedAtRef.current = result.createdAt
      savedRef.current = { ...next, title: result.title }
      valueRef.current = savedRef.current
      setValue(savedRef.current)
      const previousKey = keyRef.current
      keyRef.current = savedDraftKey(result.id)
      if (retain(valueRef.current) && previousKey !== keyRef.current) {
        try { localStorage.removeItem(previousKey) } catch { /* 보관된 사본은 남겨 둡니다. */ }
      }
      setError('')
      setSaved(true)
      setDirty(false)
      return true
    } catch (err) {
      retain(next)
      setError(err.message || '저장하지 못했습니다.')
      return false
    }
  }

  const confirmClose = async () => {
    if (sameReview(valueRef.current, savedRef.current)) return true
    const kept = retain(valueRef.current)
    return dialog.confirm(
      kept ? '서재에 반영하지 않은 글이 있습니다. 초안은 이 브라우저에 보관되어 같은 서재의 책에서 이어 쓸 수 있습니다. 닫을까요?' : '초안을 보관하지 못했습니다. 지금 닫으면 작성한 내용을 잃을 수 있습니다.',
      { title: '감상문 닫기', okLabel: kept ? '초안 보관하고 닫기' : '저장 없이 닫기', cancelLabel: '계속 쓰기' },
    )
  }

  useEffect(() => registerEditor?.({ save, confirmClose }))

  const append = (text) => {
    const next = [valueRef.current.content, text].filter(Boolean).join('\n\n')
    if (editorRef.current) editorRef.current.setMarkdown(next)
    update({ content: next })
  }

  const changeMode = (next) => {
    if (next === 'wysiwyg' || next === 'markdown') {
      if (value.format !== 'markdown') update({ format: 'markdown' })
      else editorRef.current?.changeMode(next, true)
      setMode(next)
    } else {
      update({ format: next })
      setMode(next)
    }
    setPreview(false)
  }
  useEffect(() => {
    if (value.format === 'markdown') editorRef.current?.changeMode(mode === 'markdown' ? 'markdown' : 'wysiwyg', true)
  }, [mode, value.format])

  return (
    <section className="review-editor" aria-label="감상문 편집기">
      {recovery && <div className="review-editor__recovery" role="status">
        <span>{new Date(recovery.savedAt).toLocaleString('ko-KR')}의 초안이 있습니다.</span>
        <button type="button" onClick={() => {
          update({ title: recovery.title, format: recovery.format, content: recovery.content })
          editorRef.current?.setMarkdown(recovery.content)
          setMode(recovery.format === 'markdown' ? 'wysiwyg' : recovery.format)
          setRecovery(null)
          setDraftStatus('초안을 복구했습니다.')
        }}>초안 복구</button>
        <button type="button" onClick={() => setRecovery(null)}>현재 글 유지</button>
      </div>}
      <div className="review-editor__writing" inert={!!recovery}>
      <label className="review-editor__title">감상문 제목
        <input value={value.title} onChange={(e) => update({ title: e.target.value })} placeholder="예: 두 번째 읽고 나서 달라진 생각" />
      </label>
      <div className="review-editor__tools">
        <label>편집 모드 <select value={value.format === 'markdown' ? mode : value.format} onChange={(e) => changeMode(e.target.value)}>
          <option value="wysiwyg">서식 편집</option><option value="markdown">마크다운</option>
          <option value="text">일반 텍스트</option><option value="html">HTML</option>
        </select></label>
        <button type="button" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>미리보기</button>
        <button type="button" onClick={() => setShowQuotes((v) => !v)} aria-pressed={showQuotes}>인용구 ({quotes.length})</button>
        <button type="button" disabled={!!value.content.trim()} onClick={() => append(value.format === 'html' ? '<h2>읽기 전의 기대</h2><p></p><h2>기억에 남는 장면과 문장</h2><p></p><h2>읽고 나서 달라진 생각</h2>' : TEMPLATE)}>글감 넣기</button>
      </div>
      <div className={'review-editor__workspace' + (showQuotes ? ' has-quotes' : '')}>
        <div className="review-editor__paper">
          <div className="review-editor__surface" hidden={preview}>
            {value.format === 'markdown' ? <div className="review-editor__host" ref={hostRef} /> : (
              <textarea aria-label="감상문 본문" className="review-editor__textarea" value={value.content} onChange={(e) => update({ content: e.target.value })} placeholder="이 책을 읽고 어떤 생각이 들었나요?" />
            )}
          </div>
          {preview && <div className="review-editor__preview"><ReviewViewer format={value.format} content={value.content} /></div>}
        </div>
        {showQuotes && <aside className="review-editor__quotes" aria-label="책의 인용구">
          <strong>기억해 둔 문장</strong>
          <p>누르면 본문 끝에 넣습니다.</p>
          {!quotes.length && <p>서재에서 이 책의 인용구를 먼저 기록해 보세요.</p>}
          {quotes.map((quote) => <button type="button" key={quote.id} onClick={() => {
            const text = quote.content + (quote.page ? ' (p.' + quote.page + ')' : '')
            append(value.format === 'html' ? '<blockquote>' + escapeHtml(text) + '</blockquote>' : value.format === 'text' ? text : text.split('\n').map((line) => '> ' + line).join('\n'))
            setPreview(false)
          }}>{quote.content}{quote.page && <small>p.{quote.page}</small>}</button>)}
        </aside>}
      </div>
      {error && <p className="review-editor__error" role="alert">{error}</p>}
      <div className="review-editor__status" role="status">
        <span>{value.content.length.toLocaleString()}자 · {dirty ? '서재에 미반영' : saved ? '서재에 반영됨' : '편집 준비'}</span>
        <span>{draftStatus}</span>
      </div>
      <div className="review-editor__actions">
        <button type="button" onClick={save}>저장</button>
        <button type="button" onClick={() => { if (save()) onClose() }}>저장 후 닫기</button>
        <button type="button" onClick={onClose}>닫기</button>
        <span>Ctrl+S 저장 · 파일 보관은 ‘서재 저장’</span>
      </div>
      </div>
    </section>
  )
}
