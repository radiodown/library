import { useState } from 'react'
import { searchBooks } from '../api/kakaoBooks'

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

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null) // null: 검색 전
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const handleSearch = async () => {
    if (!query.trim() || searching) return
    setSearching(true)
    setSearchError('')
    try {
      setResults(await searchBooks(query))
    } catch (err) {
      setResults(null)
      setSearchError(err.message || '검색 중 오류가 발생했습니다.')
    } finally {
      setSearching(false)
    }
  }

  const handlePick = (r) => {
    update({ title: r.title, author: r.author, isbn: r.isbn, coverUrl: r.coverUrl })
    setResults(null)
  }

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

      {!book && (
        <div className="book-search">
          <div className="book-search__bar">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearch()
                }
              }}
              placeholder="도서 검색 (제목, 저자, ISBN)"
            />
            <button type="button" onClick={handleSearch} disabled={searching}>
              {searching ? '검색 중...' : '검색'}
            </button>
          </div>
          {searchError && <p className="book-search__msg">{searchError}</p>}
          {results && results.length === 0 && (
            <p className="book-search__msg">검색 결과가 없습니다.</p>
          )}
          {results && results.length > 0 && (
            <ul className="book-search__results">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => handlePick(r)}>
                    {r.coverUrl ? (
                      <img src={r.coverUrl} alt="" />
                    ) : (
                      <span className="book-search__nocover" />
                    )}
                    <span className="book-search__info">
                      <strong>{r.title}</strong>
                      <span>{r.author || '저자 미상'}</span>
                      <span>
                        {[r.publisher, r.publishedDate].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
