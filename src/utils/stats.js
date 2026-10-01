import { splitNames } from './people'

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

  // 날짜별 완독 권수 (캘린더 히트맵용)
  const perDay = {}
  finishDates.forEach((d) => {
    perDay[d] = (perDay[d] || 0) + 1
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
  // 1~5는 항상, 0.5 단위(4.5 등)는 그런 별점을 준 책이 있을 때만 막대를 만듭니다.
  const ratingDist = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
    .filter((r) => Number.isInteger(r) || rated.some((b) => b.rating === r))
    .map((r) => ({
      rating: r,
      count: rated.filter((b) => b.rating === r).length,
    }))

  const tagCounts = {}
  books.forEach((b) => b.tags.forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1)))
  const topTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ko'))
    .slice(0, 8)

  // 완독한 책 권수 기준 저자/출판사 순위. 재독은 세지 않고, 공동 저자는 각자 한 권으로 셉니다.
  const topBy = (namesOf) => {
    const counts = {}
    finished.forEach((b) => namesOf(b).forEach((n) => (counts[n] = (counts[n] || 0) + 1)))
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'))
      .slice(0, 8)
  }
  const topAuthors = topBy((b) => splitNames(b.author))
  const topPublishers = topBy((b) => (b.publisher?.trim() ? [b.publisher.trim()] : []))

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
    perDay,
    ratingDist,
    topTags,
    topAuthors,
    topPublishers,
    // 관리가 필요한 책들
    attention: {
      noReview: finished.filter((b) => !hasReview(b)),
      stale: reading
        .filter((b) => b.startDate)
        .map((book) => ({ book, days: daysBetween(book.startDate, today) }))
        .filter((x) => x.days >= STALE_READING_DAYS)
        .sort((a, b) => b.days - a.days),
      noRating: finished.filter((b) => b.rating == null),
      // 읽은 시기를 일부러 "모름"으로 표시한 책은 날짜 누락으로 보지 않습니다.
      missingFinishDate: finished.filter((b) => !b.finishDate && !b.dateUnknown),
      missingStartDate: reading.filter((b) => !b.startDate && !b.dateUnknown),
    },
  }
}
