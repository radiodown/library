import { useState } from 'react'
import PixelIcon from './PixelIcon'

/**
 * "서재 종료" 대화상자(Windows 98의 "Windows 종료" 창 모양).
 * 저장하지 않은 변경이 있으면 경고하고, 그 자리에서 저장할 수 있게 합니다.
 * 종료해도 열어 둔 서재 데이터는 메모리에 남아 있어, 다시 켜면 이어서 쓸 수 있습니다.
 */
export default function ShutdownDialog({ isDirty, busy, onSave, onConfirm, onCancel }) {
  const [mode, setMode] = useState('shutdown')

  return (
    <div className="shutdown-dialog">
      <div className="shutdown-dialog__body">
        <span className="shutdown-dialog__icon">
          <PixelIcon name="computer" size={32} />
        </span>
        <div>
          <p className="shutdown-dialog__prompt">무엇을 하시겠습니까?</p>
          <label className="shutdown-dialog__option">
            <input
              type="radio"
              name="shutdown-mode"
              checked={mode === 'shutdown'}
              onChange={() => setMode('shutdown')}
            />
            종료
          </label>
          <label className="shutdown-dialog__option">
            <input
              type="radio"
              name="shutdown-mode"
              checked={mode === 'restart'}
              onChange={() => setMode('restart')}
            />
            다시 시작
          </label>
        </div>
      </div>

      {isDirty && (
        <p className="shutdown-dialog__warn" role="alert">
          <PixelIcon name="warning" className="pixel-icon--inline" />
          저장하지 않은 변경 사항이 있습니다.
        </p>
      )}

      <div className="shutdown-dialog__buttons">
        {isDirty && (
          <button type="button" className="quote-dialog__btn" onClick={onSave} disabled={busy}>
            저장
          </button>
        )}
        <button type="button" className="quote-dialog__btn" onClick={() => onConfirm(mode)}>
          {isDirty ? '저장 안 하고 진행' : '확인'}
        </button>
        <button type="button" className="quote-dialog__btn" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  )
}
