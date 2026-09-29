import { useEffect, useRef } from 'react'
import { useLibraryDb } from './hooks/useLibraryDb'
import { useWindowManager } from './hooks/useWindowManager'
import DesktopIcon from './components/DesktopIcon'
import Window from './components/Window'
import Taskbar from './components/Taskbar'
import LibraryWindow from './components/LibraryWindow'
import ReviewQuickWindow from './components/ReviewQuickWindow'
import ReviewEditWindow from './components/ReviewEditWindow'
import ReviewViewWindow from './components/ReviewViewWindow'
import RankingWindow from './components/RankingWindow'
import StatsWindow from './components/StatsWindow'
import QuoteOfDayWindow from './components/QuoteOfDayWindow'
import './App.css'

export default function App() {
  const libraryDb = useLibraryDb()
  const { isReady, isDirty, saveLibrary, openLibrary } = libraryDb
  const { windows, openWindow, closeWindow, focusWindow, toggleMinimize } = useWindowManager()

  // 저장하지 않은 변경사항이 있는 채로 탭을 닫으면 경고
  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // 전역 저장 단축키: Ctrl+S / ⌘S 저장, Shift를 함께 누르면 다른 이름으로 저장.
  // 브라우저의 "페이지 저장" 대화상자는 서재가 없을 때도 항상 막습니다.
  useEffect(() => {
    const handler = (e) => {
      // e.key 대신 e.code: 한글 입력 상태에서는 key가 'ㄴ'으로 들어옵니다.
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.code !== 'KeyS') return
      e.preventDefault()
      if (e.repeat || !isReady) return
      saveLibrary(e.shiftKey)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isReady, saveLibrary])

  const openLibraryWindow = () =>
    openWindow('library', {
      title: '서재',
      icon: '📚',
      initialPosition: { x: 70, y: 50 },
      initialSize: { width: 920, height: 560 },
    })

  const openReviewWindow = () =>
    openWindow('review', {
      title: '감상문 작성',
      icon: '📝',
      initialPosition: { x: 160, y: 120 },
      initialSize: { width: 640, height: 520 },
    })

  const openRankingWindow = () =>
    openWindow('ranking', {
      title: '서재 랭킹',
      icon: '🏆',
      initialPosition: { x: 120, y: 80 },
      initialSize: { width: 760, height: 520 },
    })

  const openQuoteOfDayWindow = () =>
    openWindow('quote-of-day', {
      title: '오늘의 인용구',
      icon: '💬',
      initialPosition: { x: 240, y: 130 },
      initialSize: { width: 440, height: 280 },
    })

  // Windows 98의 "오늘의 팁"처럼, 서재를 처음 열었을 때 인용구가 있으면 한 번 보여 줍니다.
  const quoteShownRef = useRef(false)
  useEffect(() => {
    if (!isReady || quoteShownRef.current) return
    quoteShownRef.current = true
    if (libraryDb.quotes.length > 0) openQuoteOfDayWindow()
    // 서재가 준비된 순간에만 판단하면 되므로 isReady만 의존합니다.
  }, [isReady])

  const openStatsWindow = () =>
    openWindow('stats', {
      title: '독서 통계',
      icon: '📊',
      initialPosition: { x: 100, y: 40 },
      initialSize: { width: 720, height: 580 },
    })

  // 서재 창의 "감상문 추가/수정"은 인라인이 아니라 별도의 뜨는 창으로 엽니다.
  const openReviewEditWindow = (book, review) => {
    const id = `review-edit-${review ? review.id : `new-${book.id}`}`
    const cascade = windows.length * 20
    openWindow(id, {
      title: `감상문 — ${book.title}`,
      icon: '📝',
      initialPosition: { x: 200 + cascade, y: 140 + cascade },
      initialSize: { width: 640, height: 520 },
      bookId: book.id,
      bookTitle: book.title,
      review: review || null,
    })
  }

  // 감상문마다 고유한 id의 창으로 열어서, 여러 감상문을 동시에 띄워 놓고 볼 수 있습니다.
  // 이미 열려 있으면 새로 만들지 않고 그 창을 앞으로 가져옵니다.
  const openReviewViewWindow = (book, review) => {
    const cascade = (windows.length % 8) * 24
    openWindow(`review-view-${review.id}`, {
      title: `감상문 보기 — ${book.title}`,
      icon: '📖',
      initialPosition: { x: 180 + cascade, y: 90 + cascade },
      initialSize: { width: 560, height: 480 },
      bookId: book.id,
      bookTitle: book.title,
      reviewId: review.id,
    })
  }

  const handleSaveIcon = () => {
    if (!isReady) {
      window.alert('먼저 "서재" 아이콘으로 서재를 열거나 새로 만들어주세요.')
      return
    }
    saveLibrary(false)
  }

  const handleToggleFromTaskbar = (id) => {
    const w = windows.find((win) => win.id === id)
    if (!w) return
    toggleMinimize(id)
    if (w.minimized) focusWindow(id)
  }

  const startMenuItems = [
    { icon: '📚', label: '서재', onClick: openLibraryWindow },
    { icon: '📝', label: '감상문 작성', onClick: openReviewWindow },
    { icon: '🏆', label: '서재 랭킹', onClick: openRankingWindow },
    { icon: '📊', label: '독서 통계', onClick: openStatsWindow },
    { icon: '💬', label: '오늘의 인용구', onClick: openQuoteOfDayWindow },
    { separator: true },
    { icon: '🆕', label: '새 서재 만들기', onClick: libraryDb.newLibrary },
    { icon: '📂', label: '서재 불러오기', onClick: openLibrary },
    { icon: '💾', label: '서재 저장', onClick: handleSaveIcon },
  ]

  const renderWindowContent = (w) => {
    if (w.id === 'library') {
      return <LibraryWindow {...libraryDb} onOpenReviewWindow={openReviewEditWindow}
          onViewReview={openReviewViewWindow}
        />
    }
    if (w.id === 'review') {
      return (
        <ReviewQuickWindow
          isReady={libraryDb.isReady}
          addOrUpdateBook={libraryDb.addOrUpdateBook}
          saveReview={libraryDb.saveReview}
          onOpenLibrary={openLibraryWindow}
        />
      )
    }
    if (w.id === 'quote-of-day') {
      return (
        <QuoteOfDayWindow
          isReady={libraryDb.isReady}
          books={libraryDb.books}
          quotes={libraryDb.quotes}
          onOpenLibrary={openLibraryWindow}
        />
      )
    }
    if (w.id === 'stats') {
      return (
        <StatsWindow
          isReady={libraryDb.isReady}
          books={libraryDb.books}
          readings={libraryDb.readings}
          getReviewCounts={libraryDb.getReviewCounts}
          reviewsVersion={libraryDb.reviewsVersion}
          onWriteReview={(book) => openReviewEditWindow(book, null)}
          onOpenLibrary={openLibraryWindow}
        />
      )
    }
    if (w.id === 'ranking') {
      return (
        <RankingWindow
          isReady={libraryDb.isReady}
          books={libraryDb.books}
          rankingIds={libraryDb.rankingIds}
          saveRanking={libraryDb.saveRanking}
          onOpenLibrary={openLibraryWindow}
        />
      )
    }
    if (w.id.startsWith('review-view-')) {
      const review = libraryDb.listReviews(w.bookId).find((r) => r.id === w.reviewId) || null
      return (
        <ReviewViewWindow
          bookTitle={w.bookTitle}
          review={review}
          onEdit={() => openReviewEditWindow({ id: w.bookId, title: w.bookTitle }, review)}
        />
      )
    }
    if (w.id.startsWith('review-edit-')) {
      return (
        <ReviewEditWindow
          bookTitle={w.bookTitle}
          bookId={w.bookId}
          review={w.review}
          saveReview={libraryDb.saveReview}
          onDone={() => closeWindow(w.id)}
        />
      )
    }
    return null
  }

  return (
    <div className="desktop">
      <div className="desktop__icons">
        <DesktopIcon icon="💾" label="서재 저장" onActivate={handleSaveIcon} />
        <DesktopIcon icon="📂" label="서재 불러오기" onActivate={openLibrary} />
        <DesktopIcon icon="📚" label="서재" onActivate={openLibraryWindow} />
        <DesktopIcon icon="📝" label="감상문" onActivate={openReviewWindow} />
      </div>

      {windows.map((w) => (
        <Window
          key={w.id}
          title={w.title}
          icon={w.icon}
          zIndex={w.zIndex}
          initialPosition={w.initialPosition}
          initialSize={w.initialSize}
          minimized={w.minimized}
          onClose={() => closeWindow(w.id)}
          onMinimize={() => toggleMinimize(w.id)}
          onFocus={() => focusWindow(w.id)}
        >
          {renderWindowContent(w)}
        </Window>
      ))}

      <Taskbar windows={windows} onToggle={handleToggleFromTaskbar} menuItems={startMenuItems} />
    </div>
  )
}
