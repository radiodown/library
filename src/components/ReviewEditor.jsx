import { useEffect, useRef, useState } from 'react'
import Editor from '@toast-ui/editor'
import '@toast-ui/editor/dist/toastui-editor.css'
import ReviewViewer from './ReviewViewer'
import MenuBar from './MenuBar'
import Toolbar from './Toolbar'
import { useDialog } from './dialogContext'
import { readReviewDraft, sameReview, writeReviewDraft } from '../utils/reviewDrafts'

const TEMPLATE = '## 읽기 전의 기대\n\n\n## 기억에 남는 장면과 문장\n\n\n## 읽고 나서 달라진 생각\n\n'
const TEMPLATE_HTML = '<h2>읽기 전의 기대</h2><p></p><h2>기억에 남는 장면과 문장</h2><p></p><h2>읽고 나서 달라진 생각</h2>'
// 보기 메뉴의 편집 방식 (서식 편집과 마크다운은 같은 마크다운 글을 두 가지로 보는 것)
const MODES = [
  { id: 'wysiwyg', label: '서식 편집' },
  { id: 'markdown', label: '마크다운' },
  { id: 'text', label: '일반 텍스트' },
  { id: 'html', label: 'HTML' },
]
const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/**
 * Windows 98 워드패드처럼: 메뉴 바 → 도구 모음 → 책 정보(header) → 서식 도구 + 본문 → 저장/닫기 → 상태 표시줄.
 * 제목 입력 칸은 없습니다. 예전에 제목을 붙인 감상문은 그 제목을 그대로 유지합니다.
 * 초안은 브라우저에, 저장 버튼은 열린 서재에 반영합니다. 파일 저장은 별도입니다.
 */
export default function ReviewEditor({ review, bookId, draftKey, savedDraftKey, quotes = [], header, onSave, onClose, registerEditor }) {
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
  const focusBodyRef = useRef(!review && !initial.draft)

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
    if (focusBodyRef.current) {
      focusBodyRef.current = false
      instance.focus()
    }
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

  const insertTemplate = () => append(value.format === 'html' ? TEMPLATE_HTML : TEMPLATE)
  const insertRule = () => append(value.format === 'html' ? '<hr>' : value.format === 'text' ? '────────' : '---')
  const currentMode = value.format === 'markdown' ? mode : value.format
  const blocked = !!recovery // 초안 복구를 고르기 전에는 다른 조작을 막습니다
  const saveAndClose = () => { if (save()) onClose() }

  const menus = [
    {
      label: '파일(F)',
      items: [
        { label: '저장', shortcut: 'Ctrl+S', onClick: save, disabled: blocked },
        { label: '저장 후 닫기', onClick: saveAndClose, disabled: blocked },
        { separator: true },
        { label: '닫기', onClick: onClose },
      ],
    },
    {
      label: '보기(V)',
      items: [
        { label: '미리보기', checked: preview, onClick: () => setPreview((v) => !v), disabled: blocked },
        { label: '인용구 패널', checked: showQuotes, onClick: () => setShowQuotes((v) => !v), disabled: blocked },
        { separator: true },
        ...MODES.map((m) => ({ label: m.label, checked: currentMode === m.id, onClick: () => changeMode(m.id), disabled: blocked })),
      ],
    },
    {
      label: '삽입(I)',
      items: [
        { label: '글감 (질문 세 개)', onClick: insertTemplate, disabled: blocked || !!value.content.trim() },
        { label: '인용구...', onClick: () => setShowQuotes(true), disabled: blocked },
        { label: '구분선', onClick: insertRule, disabled: blocked },
      ],
    },
  ]

  const toolbarItems = [
    { icon: 'floppy', label: '저장', title: '서재에 저장 (Ctrl+S)', onClick: save, disabled: blocked },
    { separator: true },
    { icon: 'eye', label: '미리보기', title: '완성된 모습 미리보기', pressed: preview, onClick: () => setPreview((v) => !v), disabled: blocked },
    { icon: 'quote', label: '인용구', title: `이 책의 인용구 ${quotes.length}개 보기`, pressed: showQuotes, onClick: () => setShowQuotes((v) => !v), disabled: blocked },
    { icon: 'document-new', label: '글감', title: '빈 글에 질문 세 개 넣기', onClick: insertTemplate, disabled: blocked || !!value.content.trim() },
  ]

  return (
    <section className="review-editor" aria-label="감상문 편집기">
      <MenuBar menus={menus} />
      <Toolbar items={toolbarItems} label="감상문 도구 모음" />
      {header}
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
      <div className="review-editor__writing" inert={blocked}>
        <div className={'review-editor__workspace' + (showQuotes ? ' has-quotes' : '')}>
          <div className="review-editor__paper">
            <div className="review-editor__surface" hidden={preview}>
              {value.format === 'markdown' ? <div className="review-editor__host" ref={hostRef} /> : (
                <textarea
                  aria-label="감상문 본문"
                  className="review-editor__textarea"
                  value={value.content}
                  onChange={(e) => update({ content: e.target.value })}
                  placeholder="이 책을 읽고 어떤 생각이 들었나요?"
                  autoFocus={!review && !initial.draft}
                />
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
        {/* 98 대화상자처럼 오른쪽 아래에 두 개만. "저장 후 닫기"는 파일 메뉴에 있습니다. */}
        <div className="review-editor__actions">
          <button type="button" onClick={save}>저장</button>
          <button type="button" onClick={onClose}>닫기</button>
        </div>
      </div>
      {/* 98식 상태 표시줄: 글자 수 | 서재 반영 상태 | 초안 보관 상태 | 편집 방식 */}
      <div className="review-editor__status" role="status">
        <span className="review-editor__pane">{value.content.length.toLocaleString()}자</span>
        <span className="review-editor__pane">{dirty ? '서재에 미반영' : saved ? '서재에 반영됨' : '편집 준비'}</span>
        <span className="review-editor__pane review-editor__pane--wide">{draftStatus}</span>
        <span className="review-editor__pane">{MODES.find((m) => m.id === currentMode)?.label}</span>
      </div>
    </section>
  )
}
