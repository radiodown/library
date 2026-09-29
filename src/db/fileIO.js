// 데스크탑의 .db 파일을 열고 저장하는 레이어.
// Chrome/Edge 등 File System Access API 지원 브라우저에서는 파일을 열어둔 채
// "저장"을 누르면 실제로 그 파일을 덮어씁니다.
// Firefox/Safari 등 미지원 브라우저에서는 <input type=file>로 불러오고,
// 저장은 새 파일 다운로드로 대체합니다(사용자가 수동으로 기존 파일 위치에 덮어써야 함).

const FILE_TYPES = [
  {
    description: 'SQLite DB 파일',
    accept: { 'application/octet-stream': ['.db', '.sqlite'] },
  },
]

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

/**
 * DB 파일을 엽니다.
 * @returns {Promise<{ buffer: ArrayBuffer, handle: FileSystemFileHandle|null, name: string }>}
 */
export async function openDbFile() {
  if (isFileSystemAccessSupported()) {
    const [handle] = await window.showOpenFilePicker({ types: FILE_TYPES })
    const file = await handle.getFile()
    const buffer = await file.arrayBuffer()
    return { buffer, handle, name: file.name }
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    // 터치 기기(iOS 등)는 알 수 없는 확장자를 accept로 거르면 .db 파일이 선택 불가로 보일 수 있어 필터를 뺍니다.
    if (!window.matchMedia('(pointer: coarse)').matches) input.accept = '.db,.sqlite'
    // 선택창을 취소하면 change가 오지 않아 busy 상태가 풀리지 않으므로 cancel도 처리합니다.
    input.addEventListener('cancel', () => reject(new DOMException('canceled', 'AbortError')))
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        reject(new Error('파일이 선택되지 않았습니다.'))
        return
      }
      const buffer = await file.arrayBuffer()
      resolve({ buffer, handle: null, name: file.name })
    }
    input.click()
  })
}

/**
 * DB 바이트를 파일로 저장합니다.
 * - handle이 있으면 그 파일에 바로 덮어씁니다.
 * - handle이 없고 API를 지원하면 "다른 이름으로 저장" 다이얼로그를 띄웁니다.
 * - API 미지원이면 브라우저 다운로드로 대체합니다.
 * @returns {Promise<FileSystemFileHandle|null>} 새로 얻은(또는 기존) 파일 핸들
 */
export async function saveDbFile(bytes, handle, suggestedName = 'library.db') {
  if (handle) {
    const writable = await handle.createWritable()
    await writable.write(bytes)
    await writable.close()
    return handle
  }

  if (isFileSystemAccessSupported()) {
    const newHandle = await window.showSaveFilePicker({
      suggestedName,
      types: FILE_TYPES,
    })
    const writable = await newHandle.createWritable()
    await writable.write(bytes)
    await writable.close()
    return newHandle
  }

  downloadBytes(bytes, suggestedName)
  return null
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
