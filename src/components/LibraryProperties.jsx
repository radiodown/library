import { useMemo } from 'react'
import PixelIcon from './PixelIcon'

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} 바이트`
  const kb = bytes / 1024
  return kb < 1024 ? `${kb.toFixed(1)} KB (${bytes.toLocaleString('ko-KR')} 바이트)` : `${(kb / 1024).toFixed(2)} MB (${bytes.toLocaleString('ko-KR')} 바이트)`
}

const formatDateTime = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' })
}

const LOCATION = {
  file: '내 PC의 파일',
  drive: 'Google Drive (앱 전용 폴더)',
}

/**
 * "서재 속성" 창. 바탕화면의 서재 아이콘을 오른쪽 클릭해 여는, Windows의 "속성" 대화상자 모양입니다.
 * 열려 있는 서재 파일의 크기, 책·감상문·인용구 수, 저장 위치와 상태를 보여 줍니다.
 */
export default function LibraryProperties({
  isReady,
  fileName,
  saveTarget,
  isDirty,
  lastSaved,
  books,
  trashedBooks,
  readings,
  quotes,
  nextBookIds,
  reviewsVersion,
  getDbInfo,
  onClose,
}) {
  // 감상문은 다른 창에서 바뀌므로 바뀔 때마다 다시 계산합니다.
  const info = useMemo(
    () => (isReady ? getDbInfo() : null),
    // books 등은 값이 아니라 "DB가 바뀌었다"는 신호입니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReady, getDbInfo, books, trashedBooks, readings, quotes, nextBookIds, reviewsVersion],
  )

  if (!isReady || !info) {
    return (
      <div className="props">
        <p className="props__empty">열려 있는 서재가 없습니다. 서재 파일을 열거나 새로 만들어 주세요.</p>
        <div className="props__buttons">
          <button type="button" className="quote-dialog__btn" onClick={onClose} autoFocus>
            확인
          </button>
        </div>
      </div>
    )
  }

  const count = (status) => books.filter((b) => b.status === status).length
  const location = LOCATION[saveTarget] || '저장되지 않음 (새 서재)'

  const rows = [
    ['종류', '서재 데이터베이스 (SQLite)'],
    ['위치', location],
    ['크기', formatSize(info.bytes)],
    null,
    ['책', `${books.length}권 (완독 ${count('finished')} · 읽는 중 ${count('reading')} · 읽고 싶음 ${count('wishlist')})`],
    ['휴지통', `${trashedBooks.length}권`],
    ['감상문', `${info.reviewCount}편 · ${info.reviewChars.toLocaleString('ko-KR')}자 (원문 기준)`],
    ['인용구', `${quotes.length}개`],
    ['다시 읽기', `${readings.length}회`],
    ['다음 책', `${nextBookIds.length}권`],
    null,
    ['처음 기록', formatDateTime(info.firstCreated)],
    ['마지막 수정', formatDateTime(info.lastUpdated)],
    [
      '마지막 저장',
      lastSaved
        ? `${lastSaved.at.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}${lastSaved.auto ? ' (자동)' : ''}`
        : '이번 실행에서는 저장 안 함',
    ],
    ['상태', isDirty ? '저장되지 않은 변경 사항이 있음' : '모두 저장됨'],
  ]

  return (
    <div className="props">
      <div className="props__head">
        <span className="props__icon">
          <PixelIcon name="library" size={32} />
        </span>
        <strong className="props__name">{fileName || '서재'}</strong>
      </div>

      <dl className="props__list">
        {rows.map((row, i) =>
          row ? (
            <div key={row[0]} className="props__row">
              <dt>{row[0]}:</dt>
              <dd>{row[1]}</dd>
            </div>
          ) : (
            <hr key={`sep-${i}`} className="props__sep" />
          ),
        )}
      </dl>

      <div className="props__buttons">
        <button type="button" className="quote-dialog__btn" onClick={onClose} autoFocus>
          확인
        </button>
      </div>
    </div>
  )
}
