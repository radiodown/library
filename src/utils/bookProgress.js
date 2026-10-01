// 책 상태에 맞는 "지금 할 일" 하나를 고릅니다. 누르면 오늘 날짜로 자동 기록합니다.
// 도구 모음, 편집 메뉴, 책 우클릭 메뉴가 같은 동작을 쓰도록 한곳에 둡니다.

/**
 * @returns {{ label: string, icon: string, run: () => void }}
 * readings: 이 책의 2회차 이후 기록, today: 'YYYY-MM-DD'
 */
export function getProgressAction({ book, readings, today, saveReading, addOrUpdateBook }) {
  // 다시 읽는 중인 회차: 시작은 했지만 아직 완독일이 없는 재독 기록
  const activeReread = readings.find((r) => r.startDate && !r.finishDate)
  if (activeReread) {
    return {
      label: `${readings.indexOf(activeReread) + 2}회차 완료`,
      icon: 'trophy',
      run: () => saveReading({ ...activeReread, finishDate: today }),
    }
  }
  if (book.status === 'wishlist') {
    return {
      label: '읽기 시작',
      icon: 'book-read',
      // 읽고 싶음 상태에서 미리 들어 있던 날짜는 무시하고 오늘부터 시작으로 기록
      run: () =>
        addOrUpdateBook({ ...book, status: 'reading', startDate: today, finishDate: '', dateUnknown: false }),
    }
  }
  if (book.status === 'reading') {
    return {
      label: '읽기 완료',
      icon: 'trophy',
      run: () => addOrUpdateBook({ ...book, status: 'finished', finishDate: today, dateUnknown: false }),
    }
  }
  return {
    label: '다시 읽기 시작',
    icon: 'book-read',
    run: () => saveReading({ bookId: book.id, startDate: today, finishDate: '', rating: null, memo: '' }),
  }
}
