import { useState } from 'react'
import BookForm from './BookForm'
import ReviewEditor from './ReviewEditor'
import PixelIcon from './PixelIcon'

/**
 * "감상문" 창의 내용.
 * 기존 책 목록에서 찾아 고르게 하지 않고, 책 정보를 바로 추가한 뒤
 * 곧바로 그 책의 감상문을 쓰는 흐름으로 동작합니다.
 */
export default function ReviewQuickWindow({ isReady, books, addOrUpdateBook, saveReview, onOpenLibrary }) {
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

  const handleCreateBook = (book) => {
    const id = addOrUpdateBook(book)
    setActiveBook({ id, title: book.title.trim() })
    setSavedAt(null)
  }

  const handleSaveReview = (review) => {
    saveReview(review)
    setSavedAt(new Date())
    setEditorKey((k) => k + 1) // 저장 후 에디터를 비워 이어서 더 쓸 수 있게 함
  }

  const handleStartAnotherBook = () => {
    setActiveBook(null)
    setSavedAt(null)
  }

  if (!activeBook) {
    return (
      <div className="review-quick">
        <p className="review-quick__hint">
          어떤 책의 감상문을 쓸까요? 책 정보를 간단히 입력하면 바로 감상문을 쓸 수 있어요.
          (자세한 정보는 나중에 "서재" 창에서 언제든 보완할 수 있습니다.)
        </p>
        <BookForm
          books={books}
          defaults={{ status: 'reading' }}
          heading="새 책 추가"
          submitLabel="책 추가하고 감상문 쓰기"
          onSave={handleCreateBook}
        />
      </div>
    )
  }

  return (
    <div className="review-quick">
      <p className="review-quick__active-book">
        <PixelIcon name="book-open" className="pixel-icon--inline" /> <strong>{activeBook.title}</strong>에 대한 감상문
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
