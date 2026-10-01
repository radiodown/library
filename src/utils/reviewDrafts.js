const PREFIX = 'library:review-draft:v1:'

export function reviewDraftKey(libraryId, book, reviewId) {
  return PREFIX + JSON.stringify([libraryId, book.id, book.createdAt, reviewId || 'new'])
}

export function readReviewDraft(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return value && typeof value.content === 'string' && typeof value.title === 'string' &&
      ['markdown', 'html', 'text'].includes(value.format) ? value : null
  } catch {
    return null
  }
}

export function writeReviewDraft(key, draft) {
  localStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() }))
}

export function listReviewDrafts(libraryId, book, reviews) {
  try {
    return Object.keys(localStorage).filter((key) => {
      if (!key.startsWith(PREFIX)) return false
      const [library, bookId, createdAt] = JSON.parse(key.slice(PREFIX.length))
      return library === libraryId && bookId === book.id && createdAt === book.createdAt
    }).map((key) => ({ key, draft: readReviewDraft(key) })).filter(({ draft }) => {
      if (!draft?.content.trim() && !draft?.title.trim()) return false
      const review = reviews.find((r) => r.id === draft.reviewId && r.createdAt === draft.reviewCreatedAt)
      return !review || !sameReview(draft, review)
    }).sort((a, b) => b.draft.savedAt - a.draft.savedAt)
  } catch {
    return []
  }
}

export function sameReview(a, b) {
  return (a?.title || '') === (b?.title || '') &&
    (a?.format || 'markdown') === (b?.format || 'markdown') &&
    (a?.content || '') === (b?.content || '')
}
