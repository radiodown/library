/**
 * 저자/역자 문자열("홍길동, 김철수")을 이름 배열로 나눕니다.
 * 카카오 도서 API가 여러 명을 쉼표로 이어 주므로, 한 명만 눌러도 그 사람의 책을 모두 찾을 수 있게 합니다.
 */
export function splitNames(value) {
  return (value || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
}
