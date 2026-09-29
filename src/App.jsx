import { useEffect } from 'react'
import { useLibraryDb } from './hooks/useLibraryDb'
import { useWindowManager } from './hooks/useWindowManager'
import DesktopIcon from './components/DesktopIcon'
import Window from './components/Window'
import Taskbar from './components/Taskbar'
import LibraryWindow from './components/LibraryWindow'
import ReviewQuickWindow from './components/ReviewQuickWindow'
import ReviewEditWindow from './components/ReviewEditWindow'
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

  const renderWindowContent = (w) => {
    if (w.id === 'library') {
      return <LibraryWindow {...libraryDb} onOpenReviewWindow={openReviewEditWindow} />
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

      <Taskbar windows={windows} onToggle={handleToggleFromTaskbar} />
    </div>
  )
}
