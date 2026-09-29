/** 이 일수 이상 "읽는 중"이면 오래 붙잡고 있는 책으로 봅니다. */
export const STALE_READING_DAYS = 30

/** 'YYYY-MM-DD' 두 날짜 사이의 일수. 시간대 영향을 받지 않도록 UTC로 계산합니다. */
function daysBetween(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

/** 로컬 날짜 기준 오늘을 'YYYY-MM-DD'로 반환합니다. */
export function todayString(now = new Date()) {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

/**
 * 서재 통계를 계산합니다.
 * books: parseBookRow 형태의 책 배열, reviewCounts: { [bookId]: 감상문 수 }, today: 'YYYY-MM-DD'
 * readings: 다시 읽기(2회차~) 기록. 연/월별 독서량과 독서 기간에 재독도 포함합니다.
 */
export function computeStats(books, reviewCounts, today, readings = []) {
  const finished = books.filter((b) => b.status === 'finished')
  const reading = books.filter((b) => b.status === 'reading')
  const hasReview = (b) => (reviewCounts[b.id] || 0) > 0

  // 완독일 목록: 1회차(완독 상태인 책) + 재독 기록. 재독은 책 상태와 무관하게 완독일이 있으면 셉니다.
  const finishDates = [
    ...finished.map((b) => b.finishDate),
    ...readings.map((r) => r.finishDate),
  ].filter(Boolean)

  // 연/월별 완독 횟수 (완독일 기준)
  const perYear = {}
  const perMonth = {} // { 'YYYY': [12개 월 카운트] }
  finishDates.forEach((finishDate) => {
    const year = finishDate.slice(0, 4)
    const month = Number(finishDate.slice(5, 7)) - 1
    perYear[year] = (perYear[year] || 0) + 1
    perMonth[year] ||= Array(12).fill(0)
    perMonth[year][month] += 1
  })

  // 데이터가 없는 중간 연도도 0으로 보여 줍니다.
  const yearKeys = Object.keys(perYear).map(Number)
  const years = []
  if (yearKeys.length > 0) {
    for (let y = Math.min(...yearKeys); y <= Math.max(...yearKeys); y += 1) {
      years.push({ year: String(y), count: perYear[y] || 0 })
    }
  }

  const rated = books.filter((b) => b.rating != null)
  const ratingDist = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: rated.filter((b) => b.rating === r).length,
  }))

  const tagCounts = {}
  books.forEach((b) => b.tags.forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1)))
  const topTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ko'))
    .slice(0, 8)

  const durations = [...finished, ...readings]
    .filter((r) => r.startDate && r.finishDate)
    .map((r) => daysBetween(r.startDate, r.finishDate))
    .filter((d) => d >= 0)

  const finishedWithReview = finished.filter(hasReview).length

  const thisYear = today.slice(0, 4)
  const thisMonth = today.slice(0, 7)
  const recentFinished = finished
    .filter((b) => b.finishDate)
    .sort((a, b) => b.finishDate.localeCompare(a.finishDate))
    .slice(0, 5)

  return {
    totals: {
      all: books.length,
      wishlist: books.filter((b) => b.status === 'wishlist').length,
      reading: reading.length,
      finished: finished.length,
    },
    avgRating: rated.length ? rated.reduce((sum, b) => sum + b.rating, 0) / rated.length : null,
    avgReadingDays: durations.length
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : null,
    reviewRate: finished.length ? finishedWithReview / finished.length : null,
    thisYearCount: finishDates.filter((d) => d.startsWith(thisYear)).length,
    thisMonthCount: finishDates.filter((d) => d.startsWith(thisMonth)).length,
    rereadCount: readings.filter((r) => r.finishDate).length,
    recentFinished,
    years,
    perMonth,
    ratingDist,
    topTags,
    // 관리가 필요한 책들
    attention: {
      noReview: finished.filter((b) => !hasReview(b)),
      stale: reading
        .filter((b) => b.startDate)
        .map((book) => ({ book, days: daysBetween(book.startDate, today) }))
        .filter((x) => x.days >= STALE_READING_DAYS)
        .sort((a, b) => b.days - a.days),
      noRating: finished.filter((b) => b.rating == null),
      missingFinishDate: finished.filter((b) => !b.finishDate),
      missingStartDate: reading.filter((b) => !b.startDate),
    },
  }
}
