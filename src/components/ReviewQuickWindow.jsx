import { useState } from 'react'
import ReviewEditor from './ReviewEditor'

const EMPTY_FORM = { title: '', author: '', status: 'reading' }

/**
 * "감상문" 창의 내용.
 * 기존 책 목록에서 찾아 고르게 하지 않고, 책 정보를 바로 추가한 뒤
 * 곧바로 그 책의 감상문을 쓰는 흐름으로 동작합니다.
 */
export default function ReviewQuickWindow({ isReady, addOrUpdateBook, saveReview, onOpenLibrary }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [activeBook, setActiveBook] = useState(null) // { id, title }
  const [savedAt, setSavedAt] = useState(null)
  const [editorKey, setEditorKey] = useState(0)

  if (!isReady) {
    return (
      <div className="review-quick review-quick--empty">
        <p>먼저 서재 파일을 열거나 새로 만들어야 합니다.</p>
        <button type="button" onClick={onOpenLibrary}>
          서재 열기
        </button>
      </div>
    )
  }

  const handleCreateBook = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const id = addOrUpdateBook({
      title: form.title.trim(),
      author: form.author.trim(),
      status: form.status,
      tags: [],
    })
    setActiveBook({ id, title: form.title.trim() })
    setSavedAt(null)
  }

  const handleSaveReview = (review) => {
    saveReview(review)
    setSavedAt(new Date())
    setEditorKey((k) => k + 1) // 저장 후 에디터를 비워 이어서 더 쓸 수 있게 함
  }

  const handleStartAnotherBook = () => {
    setActiveBook(null)
    setForm(EMPTY_FORM)
    setSavedAt(null)
  }

  if (!activeBook) {
    return (
      <div className="review-quick">
        <p className="review-quick__hint">
          어떤 책의 감상문을 쓸까요? 책 정보를 간단히 입력하면 바로 감상문을 쓸 수 있어요.
          (자세한 정보는 나중에 "서재" 창에서 언제든 보완할 수 있습니다.)
        </p>
        <form className="book-form" onSubmit={handleCreateBook}>
          <label>
            제목 *
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
              required
            />
          </label>
          <label>
            저자
            <input
              value={form.author}
              onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
            />
          </label>
          <label>
            상태
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="reading">읽는 중</option>
              <option value="finished">완독</option>
            </select>
          </label>
          <div className="book-form__actions">
            <button type="submit">책 추가하고 감상문 쓰기</button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="review-quick">
      <p className="review-quick__active-book">
        📖 <strong>{activeBook.title}</strong>에 대한 감상문
      </p>

      {savedAt && (
        <p className="review-quick__saved">✔ {savedAt.toLocaleTimeString('ko-KR')}에 저장되었습니다</p>
      )}

      <ReviewEditor
        key={editorKey}
        bookId={activeBook.id}
        onSave={handleSaveReview}
        onCancel={() => setEditorKey((k) => k + 1)}
      />

      <button type="button" className="review-quick__another" onClick={handleStartAnotherBook}>
        다른 책의 감상문 쓰기
      </button>
    </div>
  )
}
