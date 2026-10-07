import { test, expect } from '@playwright/test'
import initSqlJs from 'sql.js'

const STATUSES = ['finished', 'reading', 'wishlist']
const TITLES = [
  '채식주의자', '소년이 온다', '작별하지 않는다', '아몬드', '불편한 편의점', '달러구트 꿈 백화점',
  '코스모스', '사피엔스', '총, 균, 쇠', '이기적 유전자', '데미안', '어린 왕자', '1984', '동물농장',
  '노르웨이의 숲', '해변의 카프카', '82년생 김지영', '파친코', '토지 1', '태백산맥 1',
  '나미야 잡화점의 기적', '연금술사', '죄와 벌', '변신', '이방인', '호밀밭의 파수꾼',
]
const PUBLISHERS = ['창비', '문학동네', '민음사', '']
// 출판사 몇 곳에 저자가 겹치도록 저자는 다섯 명만 씁니다.
const bookAt = (title, i) => ({ title, author: `저자 ${'가나다라마'[i % 5]}`, publisher: PUBLISHERS[i % 4] })
const COVER = 'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F1467038%3Ftimestamp%3D20230311135622'

const SAMPLE = TITLES.map((title, i) => ({
  ...bookAt(title, i),
  coverUrl: i % 3 === 0 ? COVER : '',
  status: STATUSES[i % 3],
}))

async function sampleLibrary(books = SAMPLE) {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run(`CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, author TEXT, publisher TEXT, isbn TEXT, cover_url TEXT,
    status TEXT NOT NULL DEFAULT 'reading', start_date TEXT, finish_date TEXT, rating INTEGER, tags TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  ); CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL REFERENCES books(id),
    format TEXT, content TEXT, created_at TEXT, updated_at TEXT
  );`)
  books.forEach(({ title, author, publisher, coverUrl, status }, i) => {
    const at = new Date(Date.UTC(2024, 0, 1 + i)).toISOString()
    db.run('INSERT INTO books (title, author, publisher, cover_url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      title, author, publisher || null, coverUrl || '', status || 'wishlist', at, at,
    ])
  })
  const bytes = Buffer.from(db.export())
  db.close()
  return bytes
}

async function openShelf(page, books) {
  await page.addInitScript(() => {
    sessionStorage.setItem('library98-booted', '1')
    delete window.showOpenFilePicker // 파일 선택 창 대신 <input type=file>로 열게 합니다
    // 문서에 붙지 않은 input의 filechooser 이벤트가 가끔 오지 않아, 문서에 붙여 두고 테스트가 직접 파일을 넣습니다.
    const click = HTMLInputElement.prototype.click
    HTMLInputElement.prototype.click = function () {
      if (this.type !== 'file') return click.call(this)
      this.hidden = true
      document.body.append(this)
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: '시작', exact: true }).click()
  await page.getByRole('menuitem', { name: '서재 불러오기', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'shelf.db', mimeType: 'application/octet-stream', buffer: await sampleLibrary(books) })
  await page.locator('.desktop-icon').filter({ hasText: /^책장$/ }).dblclick()
  return page.locator('.bookshelf')
}

test('bookshelf shows spines and covers, filters, and opens a book', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const shelf = await openShelf(page)
  await expect(shelf.locator('.bookshelf__spine')).toHaveCount(TITLES.length)
  await expect(shelf.locator('.bookshelf__ribbon')).toHaveCount(TITLES.filter((_, i) => i % 3 === 1).length) // 읽는 중인 책마다 가름끈
  if (process.env.SHELF_SHOTS) await shelf.screenshot({ path: `${process.env.SHELF_SHOTS}/spine.png` })

  await shelf.getByRole('button', { name: '표지', exact: true }).click()
  await expect(shelf.locator('.bookshelf__front')).toHaveCount(TITLES.length)
  await expect(shelf.locator('.bookshelf__front img')).toHaveCount(Math.ceil(TITLES.length / 3))
  if (process.env.SHELF_SHOTS) {
    await page.waitForFunction(() => [...document.querySelectorAll('.bookshelf__front img')].every((img) => img.complete))
    await shelf.screenshot({ path: `${process.env.SHELF_SHOTS}/front.png` })
  }

  // 출판사순: 출판사 → 저자 → 제목, 출판사가 없는 책은 맨 뒤
  await shelf.getByLabel('정렬').selectOption('publisher')
  const ko = (a, b) => a.localeCompare(b, 'ko')
  const expected = TITLES.map(bookAt).sort(
    (a, b) => !a.publisher - !b.publisher || ko(a.publisher, b.publisher) || ko(a.author, b.author) || ko(a.title, b.title),
  )
  const shown = await shelf.locator('.bookshelf__front').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
  expect(shown.map((label) => label.split(' · ')[0])).toEqual(expected.map((b) => b.title))
  expect(expected.at(-1).publisher).toBe('')

  await shelf.getByLabel('상태').selectOption('finished')
  await expect(shelf.locator('.bookshelf__front')).toHaveCount(Math.ceil(TITLES.length / 3))
  await expect(shelf.locator('.bookshelf__count')).toHaveText(`${Math.ceil(TITLES.length / 3)}권`)

  await shelf.getByRole('button', { name: /^채식주의자/ }).click()
  await expect(page.locator('.win').filter({ hasText: '채식주의자' }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('series volumes share one spine look and sort by volume number', async ({ page }) => {
  const shelf = await openShelf(page, [
    { title: '토지 10', author: '박경리' },
    { title: '토지 2', author: '박경리' },
    { title: '토지 1: 서장', author: '박경리' },
    { title: '토지 1', author: '다른 저자' }, // 저자가 다르면 다른 시리즈
    { title: '해리 포터 Vol. 1', author: 'J.K. 롤링' },
    { title: '해리 포터 (2)', author: 'J.K. 롤링, 강동혁' },
    { title: 'Python 3', author: '혼자' }, // 한 권뿐이면 시리즈가 아님
  ])
  await shelf.getByLabel('정렬').selectOption('title')
  const spines = await shelf.locator('.bookshelf__spine').evaluateAll((els) =>
    els.map((el) => ({
      title: el.getAttribute('aria-label').split(' · ')[0],
      spineTitle: el.querySelector('.bookshelf__spine-title').textContent,
      volume: el.querySelector('.bookshelf__spine-volume')?.textContent ?? null,
      look: [el.style.width, el.style.height, el.style.background, el.className].join(' '),
    })),
  )
  const byTitle = Object.fromEntries(spines.map((s) => [s.title, s]))
  expect(spines.map((s) => s.title)).toEqual(['토지 1', '토지 1: 서장', '토지 2', '토지 10', '해리 포터 (2)', '해리 포터 Vol. 1', 'Python 3'])

  expect(byTitle['토지 2'].look).toBe(byTitle['토지 1: 서장'].look)
  expect(byTitle['토지 10'].look).toBe(byTitle['토지 1: 서장'].look)
  expect(['1', '2', '10'].map((v) => spines.find((s) => s.volume === v && s.title.startsWith('토지') && s.title !== '토지 1'))).not.toContain(undefined)
  expect(byTitle['해리 포터 (2)'].look).toBe(byTitle['해리 포터 Vol. 1'].look)
  expect(byTitle['토지 1: 서장'].spineTitle).toBe('토지') // 책등에는 시리즈 이름만, 권 번호는 따로
  expect(byTitle['토지 1'].volume).toBeNull()
  expect(byTitle['Python 3'].volume).toBeNull()
  if (process.env.SHELF_SHOTS) await shelf.screenshot({ path: `${process.env.SHELF_SHOTS}/series.png` })
})
