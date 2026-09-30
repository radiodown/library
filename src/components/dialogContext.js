import { createContext, useContext } from 'react'

/**
 * 브라우저 alert/confirm 대신 쓰는 Windows 98 스타일 대화상자.
 *   const dialog = useDialog()
 *   if (!(await dialog.confirm('삭제할까요?', { title: '삭제 확인', okLabel: '삭제' }))) return
 *   await dialog.alert('먼저 서재를 열어 주세요.')
 */
export const DialogContext = createContext(null)

export function useDialog() {
  const dialog = useContext(DialogContext)
  if (!dialog) throw new Error('useDialog는 DialogProvider 안에서만 쓸 수 있습니다.')
  return dialog
}
