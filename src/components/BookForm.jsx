import { useState } from 'react'

const EMPTY_BOOK = {
  title: '',
  author: '',
  isbn: '',
  coverUrl: '',
  status: 'wishlist',
  startDate: '',
  finishDate: '',
  rating: null,
  tags: [],
}

/** 책 추가/수정 폼. book이 없으면 새 책 추가 모드입니다. */
export default function BookForm({ book, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_BOOK,
    ...book,
    tagsText: (book?.tags || []).join(', '),
  }))

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return

    const tags = form.tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    onSave({
      ...form,
      id: book?.id,
      rating: form.rating === '' || form.rating === null ? null : Number(form.rating),
      tags,
    })
  }

  return (
    <form className="book-form" onSubmit={handleSubmit}>
      <h3>{book ? '책 정보 수정' : '새 책 추가'}</h3>

      <label>
        제목 *
        <input
          value={form.title}
          onChange={(e) => update({ title: e.target.value })}
          required
        />
      </label>

      <label>
        저자
        <input value={form.author} onChange={(e) => update({ author: e.target.value })} />
      </label>

      <label>
        ISBN
        <input value={form.isbn} onChange={(e) => update({ isbn: e.target.value })} />
      </label>

      <label>
        표지 이미지 URL
        <input value={form.coverUrl} onChange={(e) => update({ coverUrl: e.target.value })} />
      </label>

      <label>
        상태
        <select value={form.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="wishlist">읽고 싶음</option>
          <option value="reading">읽는 중</option>
          <option value="finished">완독</option>
        </select>
      </label>

      <div className="book-form__row">
        <label>
          읽기 시작일
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => update({ startDate: e.target.value })}
          />
        </label>
        <label>
          완독일
          <input
            type="date"
            value={form.finishDate}
            onChange={(e) => update({ finishDate: e.target.value })}
          />
        </label>
      </div>

      <label>
        별점 (1~5)
        <input
          type="number"
          min="1"
          max="5"
          value={form.rating ?? ''}
          onChange={(e) => update({ rating: e.target.value })}
        />
      </label>

      <label>
        태그 (쉼표로 구분)
        <input
          value={form.tagsText}
          onChange={(e) => update({ tagsText: e.target.value })}
          placeholder="예: 소설, SF, 추천"
        />
      </label>

      <div className="book-form__actions">
        <button type="submit">저장</button>
        <button type="button" onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  )
}
