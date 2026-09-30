import { useState } from 'react'
import { useDialog } from './dialogContext'

/** 인용구 한 건을 입력/수정하는 인라인 폼. Ctrl/⌘+Enter로도 저장할 수 있습니다. */
function QuoteForm({ initial, onSave, onCancel }) {
  const [content, setContent] = useState(initial.content)
  const [page, setPage] = useState(initial.page ?? '')

  const submit = () => {
    if (!content.trim()) return
    onSave({ content: content.trim(), page: page === '' ? null : Number(page) })
  }

  return (
    <form
      className="quote-form"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <textarea
        autoFocus
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="기억하고 싶은 문장 (Ctrl/⌘+Enter로 저장)"
      />
      <div className="quote-form__row">
        <label>
          페이지
          <input
            type="number"
            min="1"
            value={page}
            onChange={(e) => setPage(e.target.value)}
          />
        </label>
        <button type="submit" disabled={!content.trim()}>
          저장
        </button>
        <button type="button" onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  )
}

/** 책에 딸린 인용구(좋았던 문장) 목록. 감상문과 별개로 문장 단위로 쌓아 둡니다. */
export default function QuoteList({ readOnly = false, book, quotes, saveQuote, removeQuote }) {
  const [editing, setEditing] = useState(null) // null | 'new' | quote object

  const handleSave = (form) => {
    saveQuote({ ...form, id: editing === 'new' ? undefined : editing.id, bookId: book.id })
    setEditing(null)
  }

  const dialog = useDialog()

  const handleDelete = async (quote) => {
    if (!(await dialog.confirm('이 인용구를 삭제할까요?', { title: '인용구 삭제', okLabel: '삭제' }))) return
    removeQuote(quote.id)
  }

  if (readOnly && quotes.length === 0) return null

  return (
    <div className="book-detail__section">
      <div className="book-detail__section-header">
        <h3>인용구 ({quotes.length})</h3>
        {!readOnly && (
          <button type="button" onClick={() => setEditing('new')} disabled={editing !== null}>
            + 인용구 추가
          </button>
        )}
      </div>

      {editing === 'new' && (
        <QuoteForm
          initial={{ content: '', page: null }}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {quotes.length === 0 && editing === null && (
        <p className="book-detail__empty">아직 저장한 인용구가 없습니다.</p>
      )}

      <ul className="quote-list">
        {quotes.map((quote) =>
          editing && editing !== 'new' && editing.id === quote.id ? (
            <li key={quote.id}>
              <QuoteForm
                initial={quote}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={quote.id} className="quote-list__item">
              <blockquote>{quote.content}</blockquote>
              <div className="quote-list__meta">
                {quote.page != null && <span>p.{quote.page}</span>}
                {!readOnly && (
                  <span className="quote-list__actions">
                    <button type="button" onClick={() => setEditing(quote)}>
                      수정
                    </button>
                    <button type="button" className="danger" onClick={() => handleDelete(quote)}>
                      삭제
                    </button>
                  </span>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
