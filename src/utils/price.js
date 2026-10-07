/** 12345 → "12,345원" */
export function formatWon(value) {
  return `${Number(value).toLocaleString('ko-KR')}원`
}

/** 책 목록의 가격 합계. 가격을 입력하지 않은 책은 합계에서 빼고 권수를 따로 셉니다. */
export function sumPrices(books) {
  let total = 0
  let priced = 0
  for (const book of books) {
    if (book.price > 0) {
      total += book.price
      priced += 1
    }
  }
  return { total, priced, missing: books.length - priced }
}
