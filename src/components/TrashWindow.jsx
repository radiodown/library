import { useState } from 'react'
import PixelIcon from './PixelIcon'
import { useDialog } from './dialogContext'
import MenuBar from './MenuBar'

const CRUMPLE_MS = 1000 // 구겨지는 애니메이션(항목별 시차 포함)이 끝나는 시간

/**
 * "휴지통" 창의 내용. 지운 책을 복원하거나 영구 삭제하고, 휴지통을 비웁니다.
 * 복원하면 그 책의 감상문/회차/인용구도 함께 돌아옵니다.
 */
export default function TrashWindow({
  isReady,
  trashedBooks,
  restoreBook,
  purgeBook,
  emptyTrash,
  onOpenLibrary,
  onClose,
}) {
  const [emptying, setEmptying] = useState(false)
  const [notice, setNotice] = useState('')
  const dialog = useDialog()

  if (!isReady) {
    return (
      <div className="trash trash--empty">
        <p>먼저 서재 파일을 열거나 새로 만들어야 합니다.</p>
        <button type="button" onClick={onOpenLibrary}>
          서재 열기
        </button>
      </div>
    )
  }

  const handleRestore = (book) => {
    restoreBook(book.id)
    setNotice(`"${book.title}"을(를) 서재로 복원했습니다.`)
  }

  const handlePurge = async (book) => {
    const ok = await dialog.confirm(
      `"${book.title}"을(를) 완전히 삭제할까요? 감상문, 회차, 인용구도 함께 사라지며 되돌릴 수 없습니다.`,
      { title: '완전히 삭제', okLabel: '삭제' },
    )
    if (!ok) return
    purgeBook(book.id)
    setNotice(`"${book.title}"을(를) 영구 삭제했습니다.`)
  }

  const handleEmpty = async () => {
    const ok = await dialog.confirm(
      `휴지통의 책 ${trashedBooks.length}권을 모두 완전히 삭제할까요? 되돌릴 수 없습니다.`,
      { title: '휴지통 비우기', okLabel: '비우기' },
    )
    if (!ok) return
    setNotice('')
    setEmptying(true)
    // 종이가 구겨지는 애니메이션이 끝난 뒤 실제로 비웁니다. (움직임 줄이기 설정이면 바로)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setTimeout(
      () => {
        emptyTrash()
        setEmptying(false)
        setNotice('휴지통을 비웠습니다.')
      },
      reduced ? 0 : CRUMPLE_MS,
    )
  }

  const menus = [
    {
      label: '파일(F)',
      items: [
        { label: '휴지통 비우기', onClick: handleEmpty, disabled: trashedBooks.length === 0 || emptying },
        { separator: true },
        { label: '닫기', onClick: () => onClose() },
      ],
    },
  ]

  return (
    <div className="trash">
      {onClose && <MenuBar menus={menus} />}
      {trashedBooks.length === 0 ? (
        <p className="trash__empty">
          <PixelIcon name="trash" size={32} className="pixel-icon--inline" />
          휴지통이 비어 있습니다.
        </p>
      ) : (
        <ul className={`trash__list${emptying ? ' is-emptying' : ''}`}>
          {trashedBooks.map((book, i) => (
            <li key={book.id} style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
              <span className="trash__info">
                <strong>{book.title}</strong>
                <span>
                  {book.author && `${book.author} · `}
                  {new Date(book.deletedAt).toLocaleDateString('ko-KR')} 삭제
                </span>
              </span>
              <span className="trash__actions">
                <button type="button" onClick={() => handleRestore(book)} disabled={emptying}>
                  복원
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handlePurge(book)}
                  disabled={emptying}
                >
                  영구 삭제
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="trash__footer">
        <span className="trash__notice" role="status">
          {notice}
        </span>
        <button
          type="button"
          onClick={handleEmpty}
          disabled={trashedBooks.length === 0 || emptying}
        >
          휴지통 비우기
        </button>
      </div>
    </div>
  )
}
