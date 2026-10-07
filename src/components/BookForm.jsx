import { useEffect, useRef, useState } from 'react'
import { searchBooks } from '../api/kakaoBooks'
import { todayString } from '../utils/stats'
import { findDuplicateBook } from '../utils/duplicates'
import { useDialog } from './dialogContext'
import PixelIcon from './PixelIcon'
import StarRatingInput from './StarRatingInput'

const EMPTY_BOOK = {
  title: '',
  author: '',
  translator: '',
  publisher: '',
  isbn: '',
  coverUrl: '',
  price: null,
  status: 'wishlist',
  startDate: '',
  finishDate: '',
  rating: null,
  dateUnknown: false,
  tags: [],
}

/**
 * 책 추가/수정 폼. book이 없으면 새 책 추가 모드입니다.
 * defaults: 새 책 추가 때 기본값을 덮어쓸 값, heading/submitLabel: 다른 화면에서 재사용할 때의 문구
 */
export default function BookForm({
  book,
  books = [],
  defaults,
  heading,
  submitLabel = '저장',
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_BOOK,
    // 새 책은 시작일/완독일을 오늘로 채웁니다. 수정할 때는 저장된 값을 그대로 씁니다.
    ...(book ? {} : { startDate: todayString(), finishDate: todayString(), ...defaults }),
    ...book,
    tagsText: (book?.tags || []).join(', '),
  }))

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const duplicate = book ? null : findDuplicateBook(books, form)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null) // null: 검색 전
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const saveButtonRef = useRef(null)
  const activeItemRef = useRef(null)

  // 방향키로 이동한 항목이 스크롤 영역 밖이면 보이게 합니다.
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, results])

  const handleSearch = async () => {
    if (!query.trim() || searching) return
    setSearching(true)
    setSearchError('')
    try {
      setResults(await searchBooks(query))
      setActiveIndex(0)
    } catch (err) {
      setResults(null)
      setSearchError(err.message || '검색 중 오류가 발생했습니다.')
    } finally {
      setSearching(false)
    }
  }

  const handlePick = (r) => {
    update({
      title: r.title,
      author: r.author,
      translator: r.translator,
      publisher: r.publisher,
      isbn: r.isbn,
      coverUrl: r.coverUrl,
      price: r.price,
    })
    setResults(null)
    // 포커스를 저장 버튼으로 옮겨, 이어서 Enter를 누르면 바로 추가되게 합니다.
    saveButtonRef.current?.focus()
  }

  const handleSearchKeyDown = (e) => {
    const hasResults = results && results.length > 0
    if (e.key === 'ArrowDown' && hasResults) {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp' && hasResults) {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Escape' && results) {
      e.preventDefault()
      e.stopPropagation()
      setResults(null)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (hasResults) handlePick(results[activeIndex])
      else handleSearch()
    }
  }

  const dialog = useDialog()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (
      duplicate &&
      !(await dialog.confirm(
        `"${duplicate.title}"이(가) 이미 서재에 있습니다. 그래도 새 책으로 추가할까요?\n(다시 읽은 책이라면 취소하고 기존 책에서 "다시 읽기"를 추가하세요.)`,
        { title: '중복된 책', okLabel: '추가' },
      ))
    ) {
      return
    }

    const tags = form.tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    onSave({
      ...form,
      id: book?.id,
      rating: form.rating === '' || form.rating === null ? null : Number(form.rating),
      price: form.price === '' || form.price === null ? null : Number(form.price),
      tags,
    })
  }

  return (
    <form className="book-form" onSubmit={handleSubmit}>
      <h3>{heading ?? (book ? '책 정보 수정' : '새 책 추가')}</h3>

      <div className="book-search">
        <div className="book-search__bar">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setResults(null) // 검색어를 고치면 이전 결과는 무효 → 다음 Enter는 새 검색
            }}
            onKeyDown={handleSearchKeyDown}
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
            {results.map((r, i) => (
              <li
                key={r.id}
                ref={i === activeIndex ? activeItemRef : null}
                className={i === activeIndex ? 'is-active' : ''}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => handlePick(r)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {r.coverUrl ? (
                    <img src={r.coverUrl} alt="" />
                  ) : (
                    <span className="book-search__nocover" />
                  )}
                  <span className="book-search__info">
                    <strong>
                      {r.title}
                      {findDuplicateBook(books, r, book?.id) && (
                        <span className="book-search__dup">서재에 있음</span>
                      )}
                    </strong>
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

      {duplicate && (
        <p className="book-form__warn" role="alert">
          <PixelIcon name="warning" className="pixel-icon--inline" />
          이미 서재에 있는 책입니다: <strong>{duplicate.title}</strong>
          {duplicate.author && ` (${duplicate.author})`}
          <br />
          다시 읽은 책이라면 새로 추가하지 말고, 기존 책에서 &quot;다시 읽기&quot;를 추가하세요.
        </p>
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
        역자
        <input value={form.translator} onChange={(e) => update({ translator: e.target.value })} />
      </label>

      <label>
        출판사
        <input value={form.publisher} onChange={(e) => update({ publisher: e.target.value })} />
      </label>

      <label>
        ISBN
        <input value={form.isbn} onChange={(e) => update({ isbn: e.target.value })} />
      </label>

      <label>
        가격(원)
        <input
          type="number"
          min="0"
          step="100"
          inputMode="numeric"
          placeholder="예: 15000"
          value={form.price ?? ''}
          onChange={(e) => update({ price: e.target.value === '' ? null : e.target.value })}
        />
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
            disabled={form.dateUnknown}
            onChange={(e) => update({ startDate: e.target.value })}
          />
        </label>
        <label>
          완독일
          <input
            type="date"
            value={form.finishDate}
            disabled={form.dateUnknown}
            onChange={(e) => update({ finishDate: e.target.value })}
          />
        </label>
      </div>
      <label className="book-form__check">
        <input
          type="checkbox"
          checked={form.dateUnknown}
          onChange={(e) =>
            update(
              e.target.checked
                ? { dateUnknown: true, startDate: '', finishDate: '' }
                : { dateUnknown: false, startDate: todayString(), finishDate: todayString() },
            )
          }
        />
        읽은 시기를 모름 (예전에 읽어서 기억나지 않음)
      </label>

      {/* label로 감싸면 별을 누를 때 안의 "지우기" 버튼까지 눌리므로 div로 묶습니다 */}
      <div className="form-field" role="group" aria-label="별점">
        <span className="form-field__label">별점</span>
        <StarRatingInput value={form.rating} onChange={(rating) => update({ rating })} />
      </div>

      <label>
        태그 (쉼표로 구분)
        <input
          value={form.tagsText}
          onChange={(e) => update({ tagsText: e.target.value })}
          placeholder="예: 소설, SF, 추천"
        />
      </label>

      <div className="book-form__actions">
        <button type="submit" ref={saveButtonRef}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </form>
  )
}
