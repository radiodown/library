// Google Drive에 서재 DB를 올리고 내려받는 레이어.
// 브라우저 앱이라 Google Identity Services(토큰 방식)로 로그인하고 Drive REST API를 fetch로 부릅니다.
// 권한은 drive.appdata 하나뿐입니다: 이 앱 전용 숨김 폴더(appDataFolder)만 접근할 수 있고,
// 사용자의 다른 Drive 파일은 볼 수 없습니다. (Drive 웹 화면에는 보이지 않습니다.)

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const FILE_NAME = 'library.db'
const GSI_SRC = 'https://accounts.google.com/gsi/client'
const API = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files'

export function isDriveConfigured() {
  return !!CLIENT_ID
}

let gsiPromise = null
function loadGsi() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  gsiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.onload = resolve
    script.onerror = () => {
      gsiPromise = null
      reject(new Error('Google 로그인 스크립트를 불러오지 못했습니다. 네트워크를 확인해 주세요.'))
    }
    document.head.appendChild(script)
  })
  return gsiPromise
}

// 토큰과 "이미 동의함" 표시를 localStorage에 보관해, 새로고침해도 (토큰이 살아 있는 동안은) 다시 로그인하지 않게 합니다.
// drive.appdata 권한의 토큰이라 유출돼도 이 앱 전용 폴더만 접근되고, 약 1시간이면 만료됩니다.
const TOKEN_KEY = 'library:drive-token'
const CONSENT_KEY = 'library:drive-consented'

function readStorage(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // 저장할 수 없어도 이번 세션에서는 메모리 값으로 동작합니다.
  }
}

function loadStoredToken() {
  try {
    const saved = JSON.parse(readStorage(TOKEN_KEY))
    return saved?.value && saved.expiresAt > Date.now() ? saved : null
  } catch {
    return null
  }
}

let token = loadStoredToken() // { value, expiresAt }
let hasConsented = readStorage(CONSENT_KEY) === '1' || !!token

function setToken(next) {
  token = next
  writeStorage(TOKEN_KEY, next ? JSON.stringify(next) : null)
}

/**
 * 액세스 토큰을 반환합니다. 유효한 토큰이 있으면 재사용하고, 없으면 발급받습니다.
 * @param {boolean} interactive false면 팝업이 필요할 때 실패시킵니다. (자동 저장용)
 */
async function getToken(interactive) {
  if (token && token.expiresAt - Date.now() > 60_000) return token.value
  if (!CLIENT_ID) throw new Error('Google 클라이언트 ID(VITE_GOOGLE_CLIENT_ID)가 설정되지 않았습니다.')
  await loadGsi()

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (res) => {
        if (res.error) {
          reject(new Error(`Google 로그인 실패: ${res.error_description || res.error}`))
          return
        }
        setToken({ value: res.access_token, expiresAt: Date.now() + Number(res.expires_in) * 1000 })
        hasConsented = true
        writeStorage(CONSENT_KEY, '1')
        resolve(token.value)
      },
      error_callback: (err) => {
        // 팝업을 닫은 경우는 취소로 취급해 조용히 넘어갑니다.
        if (err?.type === 'popup_closed') reject(new DOMException('canceled', 'AbortError'))
        else reject(new Error(`Google 로그인 실패: ${err?.message || err?.type || '알 수 없는 오류'}`))
      },
    })
    if (!interactive && !hasConsented) {
      reject(new Error('Google Drive에 다시 로그인해야 합니다. "저장"을 눌러 주세요.'))
      return
    }
    // 이미 동의한 뒤라면 prompt를 비워 팝업 없이 갱신되도록 합니다.
    client.requestAccessToken({ prompt: hasConsented ? '' : 'consent' })
  })
}

async function driveFetch(url, options, interactive) {
  const res = await fetch(url, {
    ...options,
    headers: { ...options?.headers, Authorization: `Bearer ${await getToken(interactive)}` },
  })
  if (res.status === 401) setToken(null)
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Google Drive 오류 (${res.status}) ${detail.slice(0, 200)}`)
  }
  return res
}

/** appDataFolder에서 서재 파일을 찾습니다. 여럿이면 가장 최근 것. 없으면 null. */
async function findFile(interactive) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${FILE_NAME}' and trashed = false`,
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,modifiedTime)',
    pageSize: '1',
  })
  const res = await driveFetch(`${API}?${params}`, undefined, interactive)
  const { files } = await res.json()
  return files?.[0] || null
}

/**
 * Drive에서 서재를 내려받습니다.
 * @returns {Promise<{ buffer: ArrayBuffer, fileId: string, name: string } | null>} 없으면 null
 */
export async function downloadFromDrive() {
  const file = await findFile(true)
  if (!file) return null
  const res = await driveFetch(`${API}/${file.id}?alt=media`, undefined, true)
  return { buffer: await res.arrayBuffer(), fileId: file.id, name: FILE_NAME }
}

/**
 * Drive에 서재를 올립니다. fileId가 없으면 기존 파일을 찾고, 그것도 없으면 새로 만듭니다.
 * @returns {Promise<string>} 파일 ID
 */
export async function uploadToDrive(bytes, fileId, { interactive = true } = {}) {
  const id = fileId || (await findFile(interactive))?.id
  const blob = new Blob([bytes], { type: 'application/octet-stream' })

  if (id) {
    await driveFetch(
      `${UPLOAD_API}/${id}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/octet-stream' }, body: blob },
      interactive,
    )
    return id
  }

  const form = new FormData()
  form.append(
    'metadata',
    new Blob([JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }),
  )
  form.append('file', blob)
  const res = await driveFetch(`${UPLOAD_API}?uploadType=multipart&fields=id`, { method: 'POST', body: form }, interactive)
  return (await res.json()).id
}
