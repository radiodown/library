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

// 감상문 편집 창은 워드패드식이라 "저장 후 닫기"는 파일 메뉴, 편집 방식은 보기 메뉴에 있습니다.
async function saveAndClose(editor) {
  await editor.getByRole('menuitem', { name: '파일(F)', exact: true }).click()
  await editor.getByRole('menuitem', { name: '저장 후 닫기', exact: true }).click()
}

async function setMode(editor, label) {
  await editor.getByRole('menuitem', { name: '보기(V)', exact: true }).click()
  await editor.getByRole('menuitemcheckbox', { name: label, exact: true }).click()
}

// 도구 모음에도 "저장"이 있어서, 아래쪽 저장/닫기 버튼을 콕 집어 누릅니다.
const actions = (editor) => editor.locator('.review-editor__actions')

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
  const body = editor.locator('.toastui-editor-ww-container [contenteditable="true"]')
  await body.fill('저장해도 계속 쓸 수 있는 감상문입니다.')
  await actions(editor).getByRole('button', { name: '저장', exact: true }).click()
  await expect(body).toContainText('계속 쓸 수')
  await expect(editor).toContainText('서재에 반영됨')
  await body.fill('두 번째로 고친 감상문입니다.')
  await body.press('Control+s')
  await expect(editor).toContainText('서재에 반영됨')
  await saveAndClose(editor)
  await expect(editor).toHaveCount(0)
  const saved = page.locator('.review-picker__review').filter({ hasText: '두 번째로 고친 감상문' })
  await expect(saved).toHaveCount(1)
  await saved.click()
  await expect(editor.locator('.toastui-editor-ww-container')).toContainText('두 번째로 고친')
  await actions(editor).getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '새 감상문 쓰기', exact: true }).click()
  await expect(editor.getByLabel('감상문 제목')).toHaveCount(0)
  await expect(editor.locator('.toastui-editor-ww-container')).not.toContainText('두 번째')
  expect(errors).toEqual([])
})

test('window X preserves a draft and offers recovery', async ({ page }) => {
  const editor = await openBook(page)
  await setMode(editor, '일반 텍스트')
  await editor.getByLabel('감상문 본문').fill('아직 저장하지 않은 생각')
  await page.locator('.win').filter({ has: editor }).getByTitle('닫기', { exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('초안은 이 브라우저에 보관')
  await page.getByRole('button', { name: '계속 쓰기', exact: true }).click()
  await expect(editor.getByLabel('감상문 본문')).toHaveValue('아직 저장하지 않은 생각')
  await actions(editor).getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '초안 보관하고 닫기', exact: true }).click()
  await page.locator('.review-picker__review').filter({ hasText: '아직 저장하지 않은 생각' }).click()
  await editor.getByRole('button', { name: '초안 복구', exact: true }).click()
  await expect(editor.getByLabel('감상문 본문')).toHaveValue('아직 저장하지 않은 생각')
  await saveAndClose(editor)
  await expect(page.locator('.review-picker__review').filter({ hasText: '아직 저장하지 않은 생각' })).toHaveCount(1)
})

test('templates, preview, resize and safe HTML rendering', async ({ page }) => {
  const editor = await openBook(page)
  await editor.getByRole('button', { name: '글감', exact: true }).click()
  await expect(editor.locator('.toastui-editor-ww-container')).toContainText('읽고 나서 달라진 생각')
  await editor.getByRole('button', { name: '미리보기', exact: true }).click()
  await expect(editor.locator('.review-editor__preview')).toContainText('읽기 전의 기대')
  await editor.getByRole('button', { name: '미리보기', exact: true }).click()
  const oldHeight = (await editor.locator('.review-editor__host').boundingBox()).height
  await page.locator('.win').filter({ has: editor }).getByTitle('최대화', { exact: true }).click()
  await expect.poll(async () => (await editor.locator('.review-editor__host').boundingBox()).height).toBeGreaterThan(oldHeight)
  await setMode(editor, 'HTML')
  await editor.getByLabel('감상문 본문').fill('<p>안전한 미리보기</p><script>window.badReview = true</script>')
  await editor.getByRole('button', { name: '미리보기', exact: true }).click()
  await expect(editor.locator('.review-editor__preview')).toContainText('안전한 미리보기')
  expect(await page.evaluate(() => window.badReview)).toBeUndefined()
  await editor.getByRole('button', { name: '인용구', exact: true }).click()
  await expect(editor.getByRole('complementary')).toContainText('인용구를 먼저 기록')
})

test('changing library disables an old editor and retains its draft', async ({ page }) => {
  const editor = await openBook(page)
  await setMode(editor, '일반 텍스트')
  await editor.getByLabel('감상문 본문').fill('서재 A의 초안')
  await page.getByRole('button', { name: '시작', exact: true }).click()
  await page.getByRole('menuitem', { name: '새 서재 만들기', exact: true }).click()
  await expect(page.getByText('서재가 바뀌었습니다. 원래 서재를 열고 같은 책에서 초안을 이어 써 주세요.', { exact: true })).toBeVisible()
  await expect(editor).toHaveCount(0)
  const drafts = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('library:review-draft:')).map(([, value]) => JSON.parse(value)))
  expect(drafts.some((d) => d.content === '서재 A의 초안')).toBe(true)
})

test('legacy DB, page reload draft recovery and no duplicate review', async ({ page }) => {
  const bytes = await legacyLibrary()
  await page.addInitScript(() => {
    sessionStorage.setItem('library98-booted', '1')
    delete window.showOpenFilePicker
  })
  await page.goto('/')
  await loadFile(page, bytes)
  await page.locator('.desktop-icon').filter({ hasText: /^감상문$/ }).dblclick()
  await page.locator('.review-picker__books button').filter({ hasText: '오래된 서재' }).click()
  await page.locator('.review-picker__review').filter({ hasText: '기존 감상문' }).click()
  const editor = page.getByRole('region', { name: '감상문 편집기' })
  await expect(editor.getByLabel('감상문 본문')).toHaveValue('기존 감상문')
  await editor.getByLabel('감상문 본문').fill('새로고침 후 되살아날 문장')
  page.on('dialog', (d) => d.accept())
  await page.reload()
  await loadFile(page, bytes)
  await page.locator('.desktop-icon').filter({ hasText: /^감상문$/ }).dblclick()
  await page.locator('.review-picker__books button').filter({ hasText: '오래된 서재' }).click()
  await page.locator('.review-picker__review').filter({ hasText: '새로고침 후 되살아날 문장' }).click()
  await editor.getByRole('button', { name: '초안 복구', exact: true }).click()
  await expect(editor.getByLabel('감상문 본문')).toHaveValue('새로고침 후 되살아날 문장')
  await saveAndClose(editor)
  const downloading = page.waitForEvent('download')
  await page.locator('.desktop-icon').filter({ hasText: /^서재 저장$/ }).dblclick()
  const download = await downloading
  const savedBytes = await readFile(await download.path())
  const SQL = await initSqlJs()
  const db = new SQL.Database(savedBytes)
  expect(db.exec("SELECT COALESCE(title, ''), content FROM reviews")[0].values).toEqual([['', '새로고침 후 되살아날 문장']])
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
  await setMode(editor, '일반 텍스트')
  await editor.getByLabel('감상문 본문').fill('보관 실패도 보여야 합니다')
  await expect(editor).toContainText('초안 보관 실패')
  await actions(editor).getByRole('button', { name: '닫기', exact: true }).click()
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
  await page.locator('.review-picker__books button').filter({ hasText: '오래된 서재' }).click()
  await page.getByRole('button', { name: '새 감상문 쓰기', exact: true }).click()
  const editor = page.getByRole('region', { name: '감상문 편집기' })
  await editor.locator('.toastui-editor-ww-container [contenteditable="true"]').fill('처음 읽었을 때 지나쳤던 문장에서 이번에는 한참 머물렀다. 책이 달라진 것이 아니라, 그 사이 내가 조금 달라진 것 같다.')
  await editor.getByRole('button', { name: '인용구', exact: true }).click()
  await editor.getByRole('complementary').getByRole('button').click()
  await expect(editor.locator('.toastui-editor-ww-container')).toContainText('같은 문장도 다시 읽으면 다르게 다가온다. (p.42)')
  await setMode(editor, '마크다운')
  await expect(editor.locator('.toastui-editor-md-container')).toContainText('같은 문장도')
  await setMode(editor, '서식 편집')
  await page.screenshot({ path: 'test-results/review-editor.png', fullPage: true })
  await page.getByRole('button', { name: '시작', exact: true }).click()
  await page.getByRole('menuitem', { name: '시스템 종료...', exact: true }).click()
  const shutdown = page.locator('.shutdown-dialog')
  await shutdown.getByRole('button', { name: '확인', exact: true }).click()
  await page.getByRole('button', { name: '초안 보관하고 닫기', exact: true }).click()
  await expect(page.getByText('이제 서재를 안전하게 닫을 수 있습니다.', { exact: true })).toBeVisible()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
})

test('new review starts in the body; picker lists reading books first with review counts', async ({ page }) => {
  const editor = await openBook(page)
  // 새 감상문은 열자마자 본문에 바로 쓸 수 있습니다.
  await page.keyboard.type('바로 쓰기')
  await expect(editor.locator('.toastui-editor-ww-container')).toContainText('바로 쓰기')
  await saveAndClose(editor)
  // 읽고 싶은 책을 하나 더 추가하면, 읽는 중인 책이 여전히 위에 옵니다.
  await page.getByRole('button', { name: '새 책 추가', exact: true }).click()
  await page.getByLabel('제목 *', { exact: true }).fill('나중에 읽을 책')
  await page.getByRole('combobox', { name: '상태' }).selectOption('wishlist')
  await page.getByRole('button', { name: '책 추가', exact: true }).click()
  const books = page.locator('.review-picker__books button')
  await expect(books.first()).toContainText('테스트 독서')
  await expect(books.first()).toContainText('감상문 1')
  await expect(books.last()).toContainText('나중에 읽을 책')
})
