import { useState } from 'react'
import { useAddRequest } from '../hooks/useAddRequest'
import ItemActions from './ItemActions'
import StarRatingInput from './StarRatingInput'
import Stars from './Stars'
import { todayString } from '../utils/stats'
import { useDialog } from './dialogContext'

/** 다시 읽기(회차) 한 건을 입력/수정하는 인라인 폼. */
function ReadingForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const dialog = useDialog()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.dateUnknown && form.startDate && form.finishDate && form.finishDate < form.startDate) {
      dialog.alert('완독일이 시작일보다 빠를 수 없습니다.', { title: '날짜 확인' })
      return
    }
    onSave({
      ...form,
      rating: form.rating === '' || form.rating == null ? null : Number(form.rating),
    })
  }

  return (
    <form className="reading-form" onSubmit={handleSubmit}>
      <label>
        시작일
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
      <label className="reading-form__check">
        <input
          type="checkbox"
          checked={!!form.dateUnknown}
          onChange={(e) => update({ dateUnknown: e.target.checked, startDate: '', finishDate: '' })}
        />
        읽은 시기를 모름
      </label>
      <div className="form-field" role="group" aria-label="별점">
        <span className="form-field__label">별점</span>
        <StarRatingInput value={form.rating === '' ? null : form.rating} onChange={(rating) => update({ rating })} />
      </div>
      <label className="reading-form__memo">
        메모
        <input
          value={form.memo}
          onChange={(e) => update({ memo: e.target.value })}
          placeholder="예: 두 번째 읽으니 결말이 다르게 보임"
        />
      </label>
      <div className="reading-form__actions">
        <button type="submit">저장</button>
        <button type="button" onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  )
}

function ReadingRow({ label, reading, onEdit, onDelete }) {
  return (
    <li className="reading-list__item">
      <span className="reading-list__no">{label}</span>
      <span className="reading-list__body">
        <span>
          {reading.dateUnknown ? '읽은 시기 미상' : `${reading.startDate || '?'} ~ ${reading.finishDate || '읽는 중'}`}
          <Stars value={reading.rating} className="book-detail__rating" />
        </span>
        {reading.memo && <span className="reading-list__memo">{reading.memo}</span>}
      </span>
      {onEdit && (
        <ItemActions
          actions={[
            { icon: 'pencil', label: '회차 수정', onClick: onEdit },
            { icon: 'trash-lid', label: '회차 삭제', onClick: onDelete, danger: true },
          ]}
        />
      )}
    </li>
  )
}

/**
 * 책의 독서 회차. 1회차는 책 정보의 시작일/완독일/별점이고(정보 수정에서 바꿉니다),
 * 2회차부터는 여기서 추가하는 "다시 읽기" 기록입니다.
 */
export default function ReadingHistory({
  readOnly = false,
  book,
  readings,
  saveReading,
  removeReading,
  addRequest, // 서재 창 도구 모음/메뉴의 "회차 추가" 요청 번호
}) {
  const [editing, setEditing] = useState(null) // null | 'new' | reading object
  const sectionRef = useAddRequest(addRequest, () => setEditing('new'))

  const hasFirst = book.startDate || book.finishDate || book.rating || book.dateUnknown

  const handleSave = (form) => {
    saveReading({ ...form, id: editing === 'new' ? undefined : editing.id, bookId: book.id })
    setEditing(null)
  }

  const dialog = useDialog()

  const handleDelete = async (reading) => {
    if (!(await dialog.confirm('이 회차 기록을 삭제할까요?', { title: '회차 삭제', okLabel: '삭제' }))) return
    removeReading(reading.id)
  }

  // 보기 전용일 때 보여 줄 기록이 없으면 섹션 자체를 숨깁니다.
  if (readOnly && !hasFirst && readings.length === 0) return null

  return (
    <div className="book-detail__section" ref={sectionRef}>
      <div className="book-detail__section-header">
        <h3>독서 회차</h3>
      </div>

      {!hasFirst && readings.length === 0 && editing === null && (
        <p className="book-detail__empty">기록된 회차가 없습니다.</p>
      )}

      <ul className="reading-list">
        {hasFirst && (
          <ReadingRow
            label="1회차"
            reading={book}
          />
        )}
        {readings.map((reading, i) =>
          editing && editing !== 'new' && editing.id === reading.id ? (
            <li key={reading.id}>
              <ReadingForm
                initial={{ ...reading }}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <ReadingRow
              key={reading.id}
              label={`${i + 2}회차`}
              reading={reading}
              onEdit={readOnly ? undefined : () => setEditing(reading)}
              onDelete={readOnly ? undefined : () => handleDelete(reading)}
            />
          ),
        )}
      </ul>

      {editing === 'new' && (
        <ReadingForm
          initial={{ startDate: todayString(), finishDate: '', rating: null, memo: '' }}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
