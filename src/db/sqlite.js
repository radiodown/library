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
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'wishlist' CHECK(status IN ('wishlist','reading','finished')),
  start_date TEXT,
  finish_date TEXT,
  rating INTEGER,
  tags TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  format TEXT NOT NULL DEFAULT 'markdown' CHECK(format IN ('markdown','html','text')),
  content TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`

/** 완전히 새로운 빈 서재 DB를 메모리에 생성합니다. */
export async function createNewDatabase() {
  const SQL = await loadSqlJs()
  const db = new SQL.Database()
  db.run(SCHEMA)
  return db
}

/** 기존 .db 파일(ArrayBuffer/Uint8Array)로부터 DB를 불러옵니다. */
export async function loadDatabaseFromBuffer(buffer) {
  const SQL = await loadSqlJs()
  const db = new SQL.Database(new Uint8Array(buffer))
  db.run(SCHEMA) // 스키마가 없으면 생성, 있으면 무시(IF NOT EXISTS) — 향후 마이그레이션 지점
  return db
}

/** DB를 바이너리(Uint8Array)로 내보냅니다. 파일로 저장할 때 사용합니다. */
export function exportDatabase(db) {
  return db.export()
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
    isbn: row.isbn || '',
    coverUrl: row.cover_url || '',
    status: row.status,
    startDate: row.start_date || '',
    finishDate: row.finish_date || '',
    rating: row.rating ?? null,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getBooks(db) {
  return queryAll(db, 'SELECT * FROM books ORDER BY updated_at DESC').map(parseBookRow)
}

export function getBook(db, id) {
  const rows = queryAll(db, 'SELECT * FROM books WHERE id = ?', [id])
  return rows[0] ? parseBookRow(rows[0]) : null
}

/** book.id가 있으면 수정, 없으면 새로 추가합니다. 저장된 book의 id를 반환합니다. */
export function upsertBook(db, book) {
  const now = new Date().toISOString()
  const tagsJson = JSON.stringify(book.tags || [])

  if (book.id) {
    db.run(
      `UPDATE books SET title=?, author=?, isbn=?, cover_url=?, status=?, start_date=?, finish_date=?, rating=?, tags=?, updated_at=?
       WHERE id=?`,
      [
        book.title,
        book.author || null,
        book.isbn || null,
        book.coverUrl || null,
        book.status,
        book.startDate || null,
        book.finishDate || null,
        book.rating ?? null,
        tagsJson,
        now,
        book.id,
      ],
    )
    return book.id
  }

  db.run(
    `INSERT INTO books (title, author, isbn, cover_url, status, start_date, finish_date, rating, tags, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      book.title,
      book.author || null,
      book.isbn || null,
      book.coverUrl || null,
      book.status,
      book.startDate || null,
      book.finishDate || null,
      book.rating ?? null,
      tagsJson,
      now,
      now,
    ],
  )
  const [{ id }] = queryAll(db, 'SELECT last_insert_rowid() as id')
  return id
}

export function deleteBook(db, id) {
  db.run('DELETE FROM books WHERE id = ?', [id])
}

function parseReviewRow(row) {
  return {
    id: row.id,
    bookId: row.book_id,
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

  if (review.id) {
    db.run(`UPDATE reviews SET format=?, content=?, updated_at=? WHERE id=?`, [
      review.format,
      review.content,
      now,
      review.id,
    ])
    return review.id
  }

  db.run(
    `INSERT INTO reviews (book_id, format, content, created_at, updated_at) VALUES (?,?,?,?,?)`,
    [review.bookId, review.format, review.content, now, now],
  )
  const [{ id }] = queryAll(db, 'SELECT last_insert_rowid() as id')
  return id
}

export function deleteReview(db, id) {
  db.run('DELETE FROM reviews WHERE id = ?', [id])
}
