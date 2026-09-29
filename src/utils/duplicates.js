const normIsbn = (v = '') => v.replace(/[^0-9Xx]/g, '').toUpperCase()
const normText = (v = '') => v.toLowerCase().replace(/\s+/g,'')

/**
 * 서재에 이미 같은 책이 있는지 찾습니다. 없으면 null.
 * ISBN이 같거나, 제목과 저자가 (공백·대소문자 무시하고) 같으면 같은 책으로 봅니다.
 * 수정 중인 책 자신은 excludeId로 제외합니다.
 */
export function findDuplicateBook(books, { isbn, title, author }, excludeId) {
  const wantIsbn = normIsbn(isbn)
  const wantTitle = normText(title)
  const wantAuthor = normText(author)

  return (
    books.find((b) => {
      if (b.id === excludeId) return false
      if (wantIsbn && normIsbn(b.isbn) === wantIsbn) return true
      return !!wantTitle && normText(b.title) === wantTitle && normText(b.author) === wantAuthor
    }) || null
  )
}
