import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DialogContext } from './dialogContext'
import PixelIcon from './PixelIcon'

function Dialog({ dialog, onClose }) {
  const { kind, title, message, okLabel, cancelLabel } = dialog
  const boxRef = useRef(null)
  const previousFocus = useRef(document.activeElement)

  // 닫으면 대화상자를 열기 전에 포커스가 있던 곳으로 돌려 보냅니다.
  useEffect(() => {
    const previous = previousFocus.current
    return () => previous?.focus?.()
  }, [])

  const cancel = () => onClose(kind === 'alert')

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cancel()
    } else if (e.key === 'Tab') {
      // 대화상자 밖으로 포커스가 나가지 않게 버튼 사이에서만 돕니다.
      const buttons = [...boxRef.current.querySelectorAll('button')]
      const index = buttons.indexOf(document.activeElement)
      const next = (index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length
      e.preventDefault()
      buttons[next].focus()
    }
  }

  return (
    <div className="modal-overlay" onKeyDown={handleKeyDown}>
      <div
        className="modal98"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal98-title"
        aria-describedby="modal98-message"
        ref={boxRef}
      >
        <div className="modal98__titlebar">
          <span id="modal98-title" className="modal98__title">
            {title}
          </span>
          <button type="button" className="win__control win__control--close" onClick={cancel} title="닫기">
            ✕
          </button>
        </div>
        <div className="modal98__body">
          <span className="modal98__icon">
            <PixelIcon name="warning" size={32} />
          </span>
          <p id="modal98-message" className="modal98__message">
            {message}
          </p>
        </div>
        <div className="modal98__buttons">
          <button type="button" className="quote-dialog__btn" onClick={() => onClose(true)} autoFocus>
            {okLabel}
          </button>
          {kind === 'confirm' && (
            <button type="button" className="quote-dialog__btn" onClick={() => onClose(false)}>
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** 앱 전체에서 useDialog()를 쓸 수 있게 하고, 요청이 겹치면 차례대로 하나씩 보여 줍니다. */
export default function DialogProvider({ children }) {
  const [queue, setQueue] = useState([])

  const show = useCallback(
    (options) => new Promise((resolve) => setQueue((q) => [...q, { ...options, resolve }])),
    [],
  )

  const api = useMemo(
    () => ({
      confirm: (message, { title = '확인', okLabel = '확인', cancelLabel = '취소' } = {}) =>
        show({ kind: 'confirm', message, title, okLabel, cancelLabel }),
      alert: (message, { title = '알림', okLabel = '확인' } = {}) =>
        show({ kind: 'alert', message, title, okLabel }),
    }),
    [show],
  )

  const current = queue[0]
  const close = (result) => {
    current.resolve(result)
    setQueue((q) => q.slice(1))
  }

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current && <Dialog key={current.message} dialog={current} onClose={close} />}
    </DialogContext.Provider>
  )
}
