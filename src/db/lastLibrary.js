// 마지막으로 연 서재 파일의 사본을 브라우저(IndexedDB)에 보관합니다. (모바일 전용)
// 모바일 브라우저는 파일을 조용히 다시 열 수 없어서, 이게 없으면 앱을 열 때마다 파일을 골라야 합니다.
// 사본은 "열 당시의 스냅샷"입니다. PC에서 바뀐 내용은 파일을 다시 열어야 반영됩니다.
// IndexedDB는 사생활 보호 모드 등에서 막힐 수 있으므로 모든 접근은 실패해도 조용히 넘어갑니다.

const DB_NAME = 'library-app'
const STORE = 'last-library'
const KEY = 'last'

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run(mode, fn) {
  return openIdb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        tx.oncomplete = () => {
          db.close()
          resolve(req.result)
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }),
  )
}

/** 사본을 저장하고 { name, savedAt }를 반환합니다. 실패하면 null. */
export async function saveLastLibrary(name, bytes) {
  try {
    const record = { name, bytes, savedAt: Date.now() }
    await run('readwrite', (store) => store.put(record, KEY))
    return { name, savedAt: record.savedAt }
  } catch {
    return null
  }
}

/** 저장된 사본 { name, bytes, savedAt }. 없거나 읽을 수 없으면 null. */
export async function loadLastLibrary() {
  try {
    return (await run('readonly', (store) => store.get(KEY))) || null
  } catch {
    return null
  }
}
