import initSqlJs from 'sql.js'

let sqlJsPromise = null

/** sql.js(WASM)를 초기화합니다. 앱 전체에서 한 번만 로드되도록 캐시합니다. */
function loadSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file) => `${import.meta.env.BASE_URL}${file}`,
    })
  }
  return sqlJsPromise
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS library_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT,
  translator TEXT,
  publisher TEXT,
  isbn TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'wishlist' CHECK(status IN ('wishlist','reading','finished')),
  start_date TEXT,
  finish_date TEXT,
  rating INTEGER,
  date_unknown INTEGER NOT NULL DEFAULT 0, -- 1이면 읽은 시기를 기억하지 못하는 책(날짜는 비워 둠)
  tags TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT -- 값이 있으면 휴지통에 있는 책
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  format TEXT NOT NULL DEFAULT 'markdown' CHECK(format IN ('markdown','html','text')),
  content TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 다음에 읽을 책. position이 작을수록 먼저 읽을 책입니다.
CREATE TABLE IF NOT EXISTS next_books (
  book_id INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  position INTEGER NOT NULL
);

-- 다시 읽기(2회차~). 1회차는 books의 start_date/finish_date/rating을 그대로 씁니다.
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  start_date TEXT,
  finish_date TEXT,
  rating INTEGER,
  date_unknown INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  page INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 소설 집필. 서재의 책과는 연결되지 않는 별도의 작품들입니다.
-- 장/인물/자료는 창에서 만든 순간부터 같은 id를 쓰도록 문자열(UUID) id를 씁니다.
CREATE TABLE IF NOT EXISTS novels (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  logline TEXT NOT NULL DEFAULT '',
  daily_goal INTEGER NOT NULL DEFAULT 2000,
  char_count INTEGER NOT NULL DEFAULT 0, -- 공백 제외 글자 수(작품 목록용)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS novel_chapters (
  id TEXT PRIMARY KEY,
  novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  synopsis TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS novel_characters (
  id TEXT PRIMARY KEY,
  novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS novel_notes (
  id TEXT PRIMARY KEY,
  novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT ''
);

-- 날짜별로 그날 처음 쓰기 시작할 때의 글자 수. 오늘 쓴 분량 = 지금 글자 수 - start_chars
CREATE TABLE IF NOT EXISTS novel_progress (
  novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  start_chars INTEGER NOT NULL,
  PRIMARY KEY (novel_id, day)
);
`

const NOVEL_CHILD_TABLES = ['novel_chapters', 'novel_characters', 'novel_notes', 'novel_progress']

const CHILD_TABLES = ['reviews', 'next_books', 'readings', 'quotes']

/**
 * 스키마 생성 + 고아 데이터 정리 + 외래키 활성화.
 * sql.js(SQLite)는 외래키가 연결마다 기본 꺼져 있어서 ON DELETE CASCADE가 동작하지 않습니다.
 * 그래서 예전 버전에서 책만 지워져 남은 하위 데이터를 먼저 지운 뒤 켭니다.
 */
function prepareDatabase(db) {
  db.run(SCHEMA)
  // 서재 랭킹 기능은 "다음 책"으로 바뀌었습니다. 예전 랭킹 데이터는 더 쓰지 않으므로 지웁니다.
  db.run('DROP TABLE IF EXISTS rankings')
  // 휴지통 기능 이전에 만든 파일에는 deleted_at 컬럼이 없으므로 추가합니다. (CREATE IF NOT EXISTS로는 안 붙음)
  const bookColumns = queryAll(db, 'PRAGMA table_info(books)').map((c) => c.name)
  if (!bookColumns.includes('deleted_at')) db.run('ALTER TABLE books ADD COLUMN deleted_at TEXT')
  // 역자/출판사 기능 이전에 만든 파일에도 같은 방식으로 컬럼을 추가합니다.
  ;['translator', 'publisher'].forEach((col) => {
    if (!bookColumns.includes(col)) db.run(`ALTER TABLE books ADD COLUMN ${col} TEXT`)
  })
  // "읽은 시기 미상" 표시 이전에 만든 파일에도 컬럼을 추가합니다.
  const DATE_UNKNOWN_DDL = 'ADD COLUMN date_unknown INTEGER NOT NULL DEFAULT 0'
  if (!bookColumns.includes('date_unknown')) db.run(`ALTER TABLE books ${DATE_UNKNOWN_DDL}`)
  const readingColumns = queryAll(db, 'PRAGMA table_info(readings)').map((c) => c.name)
  if (!readingColumns.includes('date_unknown')) db.run(`ALTER TABLE readings ${DATE_UNKNOWN_DDL}`)
  CHILD_TABLES.forEach((table) => {
    db.run(`DELETE FROM ${table} WHERE book_id NOT IN (SELECT id FROM books)`)
  })
  const reviewColumns = queryAll(db, 'PRAGMA table_info(reviews)').map((c) => c.name)
  if (!reviewColumns.includes('title')) db.run("ALTER TABLE reviews ADD COLUMN title TEXT NOT NULL DEFAULT ''")
  db.run('PRAGMA foreign_keys = ON')
}

/** 완전히 새로운 빈 서재 DB를 메모리에 생성합니다. */
export async function createNewDatabase() {
  const SQL = await loadSqlJs()
  const db = new SQL.Database()
  prepareDatabase(db)
  db.run('INSERT INTO library_meta (key, value) VALUES (?, ?)', ['id', crypto.randomUUID()])
  return db
}

/** 기존 .db 파일(ArrayBuffer/Uint8Array)로부터 DB를 불러옵니다. */
export async function loadDatabaseFromBuffer(buffer) {
  const SQL = await loadSqlJs()
  const db = new SQL.Database(new Uint8Array(buffer))
  prepareDatabase(db) // 스키마가 없으면 생성(IF NOT EXISTS) — 향후 마이그레이션 지점
  if (!getLibraryId(db)) {
    // 기존 파일은 첫 저장 전에도 같은 파일을 다시 열면 같은 초안을 찾습니다.
    const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer))
    const id = Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, '0')).join('')
    db.run('INSERT INTO library_meta (key, value) VALUES (?, ?)', ['id', id])
  }
  return db
}

export function getLibraryId(db) {
  return queryAll(db, "SELECT value FROM library_meta WHERE key = 'id'")[0]?.value || null
}

/** DB를 바이너리(Uint8Array)로 내보냅니다. 파일로 저장할 때 사용합니다. */
export function exportDatabase(db) {
  const bytes = db.export()
  // sql.js의 export()는 DB를 닫았다 다시 열어 PRAGMA를 기본값으로 되돌립니다.
  // 외래키가 꺼진 채로 두면 저장한 뒤부터 책을 지워도 딸린 데이터가 함께 지워지지 않으므로 다시 켭니다.
  db.run('PRAGMA foreign_keys = ON')
  return bytes
}

/** 서재 속성 창에 보여 줄 DB 정보. export()를 쓰지 않고 페이지 수로 크기를 셉니다. */
export function getDbInfo(db) {
  const [{ page_count: pages }] = queryAll(db, 'PRAGMA page_count')
  const [{ page_size: pageSize }] = queryAll(db, 'PRAGMA page_size')
  const [reviews] = queryAll(
    db,
    `SELECT COUNT(*) AS c, COALESCE(SUM(LENGTH(content)), 0) AS chars FROM reviews
     WHERE book_id IN (SELECT id FROM books WHERE deleted_at IS NULL)`,
  )
  const [dates] = queryAll(
    db,
    'SELECT MIN(created_at) AS first, MAX(updated_at) AS last FROM books WHERE deleted_at IS NULL',
  )
  return {
    bytes: pages * pageSize,
    reviewCount: reviews.c,
    reviewChars: reviews.chars,
    firstCreated: dates.first,
    lastUpdated: dates.last,
  }
}

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

function parseBookRow(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author || '',
    translator: row.translator || '',
    publisher: row.publisher || '',
    isbn: row.isbn || '',
    coverUrl: row.cover_url || '',
    status: row.status,
    startDate: row.start_date || '',
    finishDate: row.finish_date || '',
    rating: row.rating ?? null,
    dateUnknown: !!row.date_unknown,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** 휴지통에 있지 않은 책만 반환합니다. */
export function getBooks(db) {
  return queryAll(db, 'SELECT * FROM books WHERE deleted_at IS NULL ORDER BY updated_at DESC').map(
    parseBookRow,
  )
}

/** 휴지통에 있는 책. 최근에 버린 것이 먼저 옵니다. */
export function getTrashedBooks(db) {
  return queryAll(db, 'SELECT * FROM books WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').map(
    (row) => ({ ...parseBookRow(row), deletedAt: row.deleted_at }),
  )
}

/** 책을 휴지통으로 보냅니다. 감상문/회차/인용구는 그대로 두므로 복원하면 모두 돌아옵니다. */
export function trashBook(db, id) {
  db.run('UPDATE books SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), id])
}

export function restoreBook(db, id) {
  db.run('UPDATE books SET deleted_at = NULL WHERE id = ?', [id])
}

/** 휴지통을 비웁니다. 딸린 데이터는 외래키 CASCADE로 함께 지워집니다. */
export function emptyTrash(db) {
  db.run('DELETE FROM books WHERE deleted_at IS NOT NULL')
}

export function getBook(db, id) {
  const rows = queryAll(db, 'SELECT * FROM books WHERE id = ?', [id])
  return rows[0] ? parseBookRow(rows[0]) : null
}

/** book.id가 있으면 수정, 없으면 새로 추가합니다. 저장된 book의 id를 반환합니다. */
export function upsertBook(db, book) {
  const now = new Date().toISOString()
  const tagsJson = JSON.stringify(book.tags || [])
  // 읽은 시기를 모르는 책은 날짜를 남기지 않습니다. (남아 있으면 통계에 잘못 잡힘)
  const dateUnknown = book.dateUnknown ? 1 : 0
  const startDate = dateUnknown ? null : book.startDate || null
  const finishDate = dateUnknown ? null : book.finishDate || null

  if (book.id) {
    db.run(
      `UPDATE books SET title=?, author=?, translator=?, publisher=?, isbn=?, cover_url=?, status=?, start_date=?, finish_date=?, rating=?, date_unknown=?, tags=?, updated_at=?
       WHERE id=?`,
      [
        book.title,
        book.author || null,
        book.translator || null,
        book.publisher || null,
        book.isbn || null,
        book.coverUrl || null,
        book.status,
        startDate,
        finishDate,
        book.rating ?? null,
        dateUnknown,
        tagsJson,
        now,
        book.id,
      ],
    )
    return book.id
  }

  db.run(
    `INSERT INTO books (title, author, translator, publisher, isbn, cover_url, status, start_date, finish_date, rating, date_unknown, tags, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      book.title,
      book.author || null,
      book.translator || null,
      book.publisher || null,
      book.isbn || null,
      book.coverUrl || null,
      book.status,
      startDate,
      finishDate,
      book.rating ?? null,
      dateUnknown,
      tagsJson,
      now,
      now,
    ],
  )
  const [{ id }] = queryAll(db, 'SELECT last_insert_rowid() as id')
  return id
}

/** 책을 완전히 지웁니다(휴지통에서 영구 삭제). 감상문·랭킹·회차·인용구는 외래키 CASCADE로 함께 지워집니다. */
export function deleteBook(db, id) {
  db.run('DELETE FROM books WHERE id = ?', [id])
}

/**
 * "다음 책"에 꽂힌 책 id를 순서대로 반환합니다. (맨 앞이 가장 먼저 읽을 책)
 * 읽기 시작해도 남아 있고, 완독한 책은 목록에서 빠집니다.
 */
export function getNextBookIds(db) {
  return queryAll(
    db,
    `SELECT n.book_id FROM next_books n JOIN books b ON b.id = n.book_id
     WHERE b.deleted_at IS NULL AND b.status != 'finished' ORDER BY n.position ASC`,
  ).map((r) => r.book_id)
}

/** "다음 책" 전체를 주어진 순서로 교체합니다. */
export function setNextBookIds(db, bookIds) {
  db.run('BEGIN')
  try {
    // 휴지통에 있는 책의 자리는 남겨 둬야 복원했을 때 대략 원래 자리로 돌아옵니다.
    db.run('DELETE FROM next_books WHERE book_id IN (SELECT id FROM books WHERE deleted_at IS NULL)')
    bookIds.forEach((bookId, i) => {
      db.run('INSERT INTO next_books (book_id, position) VALUES (?, ?)', [bookId, i + 1])
    })
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
}

function parseReviewRow(row) {
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title || '',
    format: row.format,
    content: row.content || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getReviewsForBook(db, bookId) {
  return queryAll(db, 'SELECT * FROM reviews WHERE book_id = ? ORDER BY created_at DESC', [bookId]).map(
    parseReviewRow,
  )
}

/** review.id가 있으면 수정, 없으면 새로 추가합니다. 저장된 review의 id를 반환합니다. */
export function upsertReview(db, review) {
  const now = new Date().toISOString()
  if (!queryAll(db, 'SELECT id FROM books WHERE id = ? AND deleted_at IS NULL', [review.bookId]).length) {
    throw new Error('이 책을 찾을 수 없습니다. 초안을 보관한 뒤 서재를 확인해 주세요.')
  }

  if (review.id) {
    if (!queryAll(db, 'SELECT id FROM reviews WHERE id = ? AND book_id = ?', [review.id, review.bookId]).length) {
      throw new Error('이 감상문이 삭제되었거나 다른 책에 속해 있습니다. 초안은 유지됩니다.')
    }
    db.run(`UPDATE reviews SET title=?, format=?, content=?, updated_at=? WHERE id=? AND book_id=?`, [
      review.title || '',
      review.format,
      review.content,
      now,
      review.id,
      review.bookId,
    ])
    return review.id
  }

  db.run(
    `INSERT INTO reviews (book_id, title, format, content, created_at, updated_at) VALUES (?,?,?,?,?,?)`,
    [review.bookId, review.title || '', review.format, review.content, now, now],
  )
  const [{ id }] = queryAll(db, 'SELECT last_insert_rowid() as id')
  return id
}

/** 휴지통에 있지 않은 책의 모든 감상문. 전체 검색에 씁니다. */
export function getAllReviews(db) {
  return queryAll(
    db,
    `SELECT * FROM reviews WHERE book_id IN (SELECT id FROM books WHERE deleted_at IS NULL)
     ORDER BY updated_at DESC`,
  ).map(parseReviewRow)
}

/** 책별 감상문 개수를 { [bookId]: count } 로 반환합니다. */
export function getReviewCounts(db) {
  const counts = {}
  queryAll(db, 'SELECT book_id, COUNT(*) AS c FROM reviews GROUP BY book_id').forEach((r) => {
    counts[r.book_id] = r.c
  })
  return counts
}

export function deleteReview(db, id) {
  db.run('DELETE FROM reviews WHERE id = ?', [id])
}

function parseReadingRow(row) {
  return {
    id: row.id,
    bookId: row.book_id,
    startDate: row.start_date || '',
    finishDate: row.finish_date || '',
    rating: row.rating ?? null,
    dateUnknown: !!row.date_unknown,
    memo: row.memo || '',
    createdAt: row.created_at,
  }
}

/** 모든 책의 다시 읽기(2회차~) 기록. 책별로 시작일 순서입니다. */
export function getReadings(db) {
  return queryAll(
    db,
    `SELECT * FROM readings WHERE book_id IN (SELECT id FROM books WHERE deleted_at IS NULL)
     ORDER BY book_id, COALESCE(NULLIF(start_date, ''), '9999'), id`,
  ).map(parseReadingRow)
}

/** reading.id가 있으면 수정, 없으면 새로 추가합니다. */
export function upsertReading(db, reading) {
  const now = new Date().toISOString()
  const dateUnknown = reading.dateUnknown ? 1 : 0
  const values = [
    dateUnknown ? null : reading.startDate || null,
    dateUnknown ? null : reading.finishDate || null,
    reading.rating ?? null,
    dateUnknown,
    reading.memo || null,
  ]

  if (reading.id) {
    db.run(
      'UPDATE readings SET start_date=?, finish_date=?, rating=?, date_unknown=?, memo=?, updated_at=? WHERE id=?',
      [...values, now, reading.id],
    )
    return reading.id
  }

  db.run(
    `INSERT INTO readings (book_id, start_date, finish_date, rating, date_unknown, memo, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [reading.bookId, ...values, now, now],
  )
  const [{ id }] = queryAll(db, 'SELECT last_insert_rowid() as id')
  return id
}

export function deleteReading(db, id) {
  db.run('DELETE FROM readings WHERE id = ?', [id])
}

function parseQuoteRow(row) {
  return {
    id: row.id,
    bookId: row.book_id,
    content: row.content,
    page: row.page ?? null,
    createdAt: row.created_at,
  }
}

/** 모든 책의 인용구. 최근에 적은 것이 먼저 옵니다. */
export function getQuotes(db) {
  return queryAll(
    db,
    `SELECT * FROM quotes WHERE book_id IN (SELECT id FROM books WHERE deleted_at IS NULL)
     ORDER BY created_at DESC, id DESC`,
  ).map(parseQuoteRow)
}

/** quote.id가 있으면 수정, 없으면 새로 추가합니다. */
export function upsertQuote(db, quote) {
  const now = new Date().toISOString()

  if (quote.id) {
    db.run('UPDATE quotes SET content=?, page=?, updated_at=? WHERE id=?', [
      quote.content,
      quote.page ?? null,
      now,
      quote.id,
    ])
    return quote.id
  }

  db.run(
    'INSERT INTO quotes (book_id, content, page, created_at, updated_at) VALUES (?,?,?,?,?)',
    [quote.bookId, quote.content, quote.page ?? null, now, now],
  )
  const [{ id }] = queryAll(db, 'SELECT last_insert_rowid() as id')
  return id
}

export function deleteQuote(db, id) {
  db.run('DELETE FROM quotes WHERE id = ?', [id])
}

// ---- 소설 집필 ----

/** 작품 목록. 최근에 고친 작품이 먼저 옵니다. */
export function getNovels(db) {
  return queryAll(db, 'SELECT id, title, char_count, updated_at FROM novels ORDER BY updated_at DESC').map((row) => ({
    id: row.id,
    title: row.title,
    chars: row.char_count,
    updatedAt: row.updated_at,
  }))
}

/** 작품 하나를 장/인물/자료/진행 기록까지 모두 읽습니다. */
export function getNovel(db, id) {
  const [row] = queryAll(db, 'SELECT * FROM novels WHERE id = ?', [id])
  if (!row) return null
  const children = (table) => queryAll(db, `SELECT * FROM ${table} WHERE novel_id = ? ORDER BY position`, [id])
  const progress = {}
  queryAll(db, 'SELECT day, start_chars FROM novel_progress WHERE novel_id = ?', [id]).forEach((r) => {
    progress[r.day] = { start: r.start_chars }
  })
  return {
    id: row.id,
    title: row.title,
    logline: row.logline,
    dailyGoal: row.daily_goal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    progress,
    chapters: children('novel_chapters').map((r) => ({ id: r.id, title: r.title, synopsis: r.synopsis, text: r.content })),
    characters: children('novel_characters').map((r) => ({ id: r.id, name: r.name, role: r.role, memo: r.memo })),
    notes: children('novel_notes').map((r) => ({ id: r.id, title: r.title, text: r.content })),
  }
}

/**
 * 작품 전체를 저장합니다. 장/인물/자료는 순서까지 그대로 다시 씁니다.
 * charCount: 공백 제외 글자 수(작품 목록에 보여 줌)
 */
export function saveNovel(db, novel, charCount) {
  const now = new Date().toISOString()
  db.run('BEGIN')
  try {
    db.run(
      `INSERT INTO novels (id, title, logline, daily_goal, char_count, created_at, updated_at) VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, logline=excluded.logline, daily_goal=excluded.daily_goal,
         char_count=excluded.char_count, updated_at=excluded.updated_at`,
      [novel.id, novel.title, novel.logline || '', novel.dailyGoal ?? 0, charCount, novel.createdAt || now, now],
    )
    NOVEL_CHILD_TABLES.forEach((table) => db.run(`DELETE FROM ${table} WHERE novel_id = ?`, [novel.id]))
    novel.chapters.forEach((c, i) =>
      db.run('INSERT INTO novel_chapters (id, novel_id, position, title, synopsis, content) VALUES (?,?,?,?,?,?)', [
        c.id, novel.id, i, c.title, c.synopsis || '', c.text,
      ]),
    )
    novel.characters.forEach((c, i) =>
      db.run('INSERT INTO novel_characters (id, novel_id, position, name, role, memo) VALUES (?,?,?,?,?,?)', [
        c.id, novel.id, i, c.name, c.role || '', c.memo || '',
      ]),
    )
    novel.notes.forEach((n, i) =>
      db.run('INSERT INTO novel_notes (id, novel_id, position, title, content) VALUES (?,?,?,?,?)', [
        n.id, novel.id, i, n.title, n.text,
      ]),
    )
    Object.entries(novel.progress || {}).forEach(([day, p]) =>
      db.run('INSERT INTO novel_progress (novel_id, day, start_chars) VALUES (?,?,?)', [novel.id, day, p.start]),
    )
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
}

export function deleteNovel(db, id) {
  NOVEL_CHILD_TABLES.forEach((table) => db.run(`DELETE FROM ${table} WHERE novel_id = ?`, [id]))
  db.run('DELETE FROM novels WHERE id = ?', [id])
}
