const ENDPOINT = 'https://dapi.kakao.com/v3/search/book'
// 정적 사이트라 빌드 결과물에 키가 포함됩니다. 유출돼도 피해가 검색 할당량뿐인 REST 키만 쓰세요.
const API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY

/** 카카오 isbn은 "ISBN10 ISBN13" 형태(둘 중 하나만 있을 수도 있음)라 13자리를 우선합니다. */
function pickIsbn(isbn = '') {
  const parts = isbn.split(' ').filter(Boolean)
  return parts.find((p) => p.length === 13) || parts[0] || ''
}

/** 카카오 도서 검색 API로 책을 검색해 폼에서 쓰는 형태로 반환합니다. */
export async function searchBooks(query, signal) {
  const q = query.trim()
  if (!q) return []

  if (!API_KEY) {
    throw new Error('카카오 API 키(VITE_KAKAO_REST_API_KEY)가 설정되지 않았습니다.')
  }

  const params = new URLSearchParams({ query: q, size: '10' })
  const res = await fetch(`${ENDPOINT}?${params}`, {
    headers: { Authorization: `KakaoAK ${API_KEY}` },
    signal,
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('카카오 API 키가 올바르지 않습니다.')
    if (res.status === 429) throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.')
    throw new Error(`검색에 실패했습니다. (${res.status})`)
  }

  const data = await res.json()
  return (data.documents || []).map((doc, i) => ({
    id: `${doc.isbn || doc.title}-${i}`,
    title: doc.title || '',
    author: (doc.authors || []).join(', '),
    isbn: pickIsbn(doc.isbn),
    coverUrl: doc.thumbnail || '',
    publisher: doc.publisher || '',
    publishedDate: doc.datetime ? doc.datetime.slice(0, 10) : '',
  }))
}
