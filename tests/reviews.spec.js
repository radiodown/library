import { test, expect } from '@playwright/test'
import initSqlJs from 'sql.js'
import { readFile } from 'node:fs/promises'

async function legacyLibrary() {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run(`CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, author TEXT, isbn TEXT, cover_url TEXT,
    status TEXT NOT NULL DEFAULT 'reading', start_date TEXT, finish_date TEXT, rating INTEGER, tags TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  ); CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL REFERENCES books(id),
    format TEXT, content TEXT, created_at TEXT, updated_at TEXT
  ); INSERT INTO books (title, author, created_at, updated_at) VALUES ('오래된 서재', '저자', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z');
     INSERT INTO reviews (book_id, format, content, created_at, updated_at) VALUES (1, 'text', '기존 감상문', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z');`)
  const bytes = Buffer.from(db.export())
  db.close()
  return bytes
}

async function loadFile(page, bytes) {
  const choosing = page.waitForEvent('filechooser')
  await page.locator('.desktop-icon').filter({ hasText: '서재 불러오기' }).dblclick()
  await (await choosing).setFiles({ name: 'legacy.db', mimeType: 'application/octet-stream', buffer: bytes })
}

async function openBook(page) {
  await page.addInitScript(() => sessionStorage.setItem('library98-booted', '1'))
  await page.goto('/')
  await page.getByRole('button', { name: '시작', exact: true }).click()
  await page.getByRole('menuitem', { name: '새 서재 만들기', exact: true }).click()
  await page.locator('.desktop-icon').filter({ hasText: /^감상문$/ }).dblclick()
  await page.getByRole('button', { name: '새 책 추가', exact: true }).click()
  await page.getByLabel('제목 *', { exact: true }).fill('테스트 독서')
  await page.getByLabel('저자', { exact: true }).fill('테스트 저자')
  await page.getByRole('button', { name: '책 추가', exact: true }).click()
  await page.getByRole('button', { name: '새 감상문 쓰기', exact: true }).click()
  return page.getByRole('region', { name: '감상문 편집기' })
}

test('save, continue, Ctrl+S, close and reopen one review; start a second review', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const editor = await openBook(page)
  await editor.getByLabel('감상문 제목').fill('첫 독서의 생각')
  const body = editor.locator('.toastui-editor-ww-container [contenteditable="true"]')
  await body.fill('저장해도 계속 쓸 수 있는 감상문입니다.')
  await editor.getByRole('button', { name: '저장', exact: true }).click()
  await expect(body).toContainText('계속 쓸 수')
  await expect(editor).toContainText('서재에 반영됨')
  await body.fill('두 번째로 고친 감상문입니다.')
  await body.press('Control+s')
  await expect(editor).toContainText('서재에 반영됨')
  await editor.getByRole('button', { name: '저장 후 닫기', exact: true }).click()
  await expect(editor).toHaveCount(0)
  const saved = page.locator('.review-picker__review').filter({ hasText: '첫 독서의 생각' })
  await expect(saved).toHaveCount(1)
  await saved.click()
  await expect(editor.locator('.toastui-editor-ww-container')).toContainText('두 번째로 고친')
  await editor.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '새 감상문 쓰기', exact: true }).click()
  await expect(editor.getByLabel('감상문 제목')).toHaveValue('')
  await expect(editor.locator('.toastui-editor-ww-container')).not.toContainText('두 번째')
  expect(errors).toEqual([])
})

test('window X preserves a draft and offers recovery', async ({ page }) => {
  const editor = await openBook(page)
  await editor.getByLabel('감상문 제목').fill('보관할 초안')
  await editor.getByLabel('편집 모드').selectOption('text')
  await editor.getByLabel('감상문 본문').fill('아직 저장하지 않은 생각')
  await page.locator('.win').filter({ has: editor }).getByTitle('닫기', { exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('초안은 이 브라우저에 보관')
  await page.getByRole('button', { name: '계속 쓰기', exact: true }).click()
  await expect(editor.getByLabel('감상문 본문')).toHaveValue('아직 저장하지 않은 생각')
  await editor.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '초안 보관하고 닫기', exact: true }).click()
  await page.locator('.review-picker__review').filter({ hasText: '보관할 초안' }).click()
  await editor.getByRole('button', { name: '초안 복구', exact: true }).click()
  await expect(editor.getByLabel('감상문 제목')).toHaveValue('보관할 초안')
  await expect(editor.getByLabel('감상문 본문')).toHaveValue('아직 저장하지 않은 생각')
  await editor.getByRole('button', { name: '저장 후 닫기', exact: true }).click()
  await expect(page.locator('.review-picker__review').filter({ hasText: '보관할 초안' })).toHaveCount(1)
})

test('templates, preview, resize and safe HTML rendering', async ({ page }) => {
  const editor = await openBook(page)
  await editor.getByRole('button', { name: '글감 넣기', exact: true }).click()
  await expect(editor.locator('.toastui-editor-ww-container')).toContainText('읽고 나서 달라진 생각')
  await editor.getByRole('button', { name: '미리보기', exact: true }).click()
  await expect(editor.locator('.review-editor__preview')).toContainText('읽기 전의 기대')
  await editor.getByRole('button', { name: '미리보기', exact: true }).click()
  const oldHeight = (await editor.locator('.review-editor__host').boundingBox()).height
  await page.locator('.win').filter({ has: editor }).getByTitle('최대화', { exact: true }).click()
  await expect.poll(async () => (await editor.locator('.review-editor__host').boundingBox()).height).toBeGreaterThan(oldHeight)
  await editor.getByLabel('편집 모드').selectOption('html')
  await editor.getByLabel('감상문 본문').fill('<p>안전한 미리보기</p><script>window.badReview = true</script>')
  await editor.getByRole('button', { name: '미리보기', exact: true }).click()
  await expect(editor.locator('.review-editor__preview')).toContainText('안전한 미리보기')
  expect(await page.evaluate(() => window.badReview)).toBeUndefined()
  await editor.getByRole('button', { name: '인용구 (0)', exact: true }).click()
  await expect(editor.getByRole('complementary')).toContainText('인용구를 먼저 기록')
})

test('changing library disables an old editor and retains its draft', async ({ page }) => {
  const editor = await openBook(page)
  await editor.getByLabel('편집 모드').selectOption('text')
  await editor.getByLabel('감상문 본문').fill('서재 A의 초안')
  await page.getByRole('button', { name: '시작', exact: true }).click()
  await page.getByRole('menuitem', { name: '새 서재 만들기', exact: true }).click()
  await expect(page.getByText('서재가 바뀌었습니다. 원래 서재를 열고 같은 책에서 초안을 이어 써 주세요.', { exact: true })).toBeVisible()
  await expect(editor).toHaveCount(0)
  const drafts = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('library:review-draft:')).map(([, value]) => JSON.parse(value)))
  expect(drafts.some((d) => d.content === '서재 A의 초안')).toBe(true)
})

test('legacy DB, page reload draft recovery, title round trip and no duplicate review', async ({ page }) => {
  const bytes = await legacyLibrary()
  await page.addInitScript(() => {
    sessionStorage.setItem('library98-booted', '1')
    delete window.showOpenFilePicker
  })
  await page.goto('/')
  await loadFile(page, bytes)
  await page.locator('.desktop-icon').filter({ hasText: /^감상문$/ }).dblclick()
  await page.getByRole('button', { name: '오래된 서재 저자', exact: true }).click()
  await page.locator('.review-picker__review').filter({ hasText: '제목 없는 감상문' }).click()
  const editor = page.getByRole('region', { name: '감상문 편집기' })
  await expect(editor.getByLabel('감상문 본문')).toHaveValue('기존 감상문')
  await editor.getByLabel('감상문 제목').fill('다시 읽은 생각')
  await editor.getByLabel('감상문 본문').fill('새로고침 후 되살아날 문장')
  page.on('dialog', (d) => d.accept())
  await page.reload()
  await loadFile(page, bytes)
  await page.locator('.desktop-icon').filter({ hasText: /^감상문$/ }).dblclick()
  await page.getByRole('button', { name: '오래된 서재 저자', exact: true }).click()
  await page.locator('.review-picker__review').filter({ hasText: '다시 읽은 생각' }).click()
  await editor.getByRole('button', { name: '초안 복구', exact: true }).click()
  await expect(editor.getByLabel('감상문 본문')).toHaveValue('새로고침 후 되살아날 문장')
  await editor.getByRole('button', { name: '저장 후 닫기', exact: true }).click()
  const downloading = page.waitForEvent('download')
  await page.locator('.desktop-icon').filter({ hasText: /^서재 저장$/ }).dblclick()
  const download = await downloading
  const savedBytes = await readFile(await download.path())
  const SQL = await initSqlJs()
  const db = new SQL.Database(savedBytes)
  expect(db.exec('SELECT title, content FROM reviews')[0].values).toEqual([['다시 읽은 생각', '새로고침 후 되살아날 문장']])
  expect(db.exec("SELECT value FROM library_meta WHERE key = 'id'")[0].values[0][0]).toHaveLength(64)
  db.close()
})

test('storage failure is visible and closing requires explicit confirmation', async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('library:review-draft:')) throw new DOMException('full', 'QuotaExceededError')
      return setItem.call(this, key, value)
    }
  })
  const editor = await openBook(page)
  await editor.getByLabel('편집 모드').selectOption('text')
  await editor.getByLabel('감상문 본문').fill('보관 실패도 보여야 합니다')
  await expect(editor).toContainText('초안 보관 실패')
  await editor.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('초안을 보관하지 못했습니다')
  await page.getByRole('button', { name: '계속 쓰기', exact: true }).click()
  await expect(editor.getByLabel('감상문 본문')).toHaveValue('보관 실패도 보여야 합니다')
})

test('insert a real quote, retain content across modes, and confirm shutdown once', async ({ page }) => {
  const SQL = await initSqlJs()
  const db = new SQL.Database(await legacyLibrary())
  db.run(`CREATE TABLE quotes (id INTEGER PRIMARY KEY, book_id INTEGER, content TEXT, page INTEGER, created_at TEXT, updated_at TEXT);
    INSERT INTO quotes VALUES (1, 1, '같은 문장도 다시 읽으면 다르게 다가온다.', 42, '2024-01-01', '2024-01-01');`)
  const bytes = Buffer.from(db.export())
  db.close()
  await page.addInitScript(() => {
    sessionStorage.setItem('library98-booted', '1')
    delete window.showOpenFilePicker
  })
  await page.goto('/')
  await loadFile(page, bytes)
  await page.locator('.desktop-icon').filter({ hasText: /^감상문$/ }).dblclick()
  await page.getByRole('button', { name: '오래된 서재 저자', exact: true }).click()
  await page.getByRole('button', { name: '새 감상문 쓰기', exact: true }).click()
  const editor = page.getByRole('region', { name: '감상문 편집기' })
  await editor.getByLabel('감상문 제목').fill('같은 책, 달라진 나의 생각')
  await editor.locator('.toastui-editor-ww-container [contenteditable="true"]').fill('처음 읽었을 때 지나쳤던 문장에서 이번에는 한참 머물렀다. 책이 달라진 것이 아니라, 그 사이 내가 조금 달라진 것 같다.')
  await editor.getByRole('button', { name: '인용구 (1)', exact: true }).click()
  await editor.getByRole('complementary').getByRole('button').click()
  await expect(editor.locator('.toastui-editor-ww-container')).toContainText('같은 문장도 다시 읽으면 다르게 다가온다. (p.42)')
  await editor.getByLabel('편집 모드').selectOption('markdown')
  await expect(editor.locator('.toastui-editor-md-container')).toContainText('같은 문장도')
  await editor.getByLabel('편집 모드').selectOption('wysiwyg')
  await page.screenshot({ path: 'test-results/review-editor.png', fullPage: true })
  await page.getByRole('button', { name: '시작', exact: true }).click()
  await page.getByRole('menuitem', { name: '시스템 종료...', exact: true }).click()
  const shutdown = page.locator('.shutdown-dialog')
  await shutdown.getByRole('button', { name: '확인', exact: true }).click()
  await page.getByRole('button', { name: '초안 보관하고 닫기', exact: true }).click()
  await expect(page.getByText('이제 서재를 안전하게 닫을 수 있습니다.', { exact: true })).toBeVisible()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
})
