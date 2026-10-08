import { useCallback, useEffect, useRef, useState } from 'react'
import { useLibraryDb } from './hooks/useLibraryDb'
import { useWindowManager } from './hooks/useWindowManager'
import { setDesktopMode, useDesktopMode, useIsMobile } from './hooks/useMediaQuery'
import { useTheme } from './hooks/useTheme'
import DesktopIcon from './components/DesktopIcon'
import Window from './components/Window'
import Taskbar from './components/Taskbar'
import LibraryWindow from './components/LibraryWindow'
import ReviewQuickWindow from './components/ReviewQuickWindow'
import ReviewEditWindow from './components/ReviewEditWindow'
import ReviewViewWindow from './components/ReviewViewWindow'
import NextBooksWindow from './components/NextBooksWindow'
import BookshelfWindow from './components/BookshelfWindow'
import StatsWindow from './components/StatsWindow'
import QuoteOfDayWindow from './components/QuoteOfDayWindow'
import MobileLibrary from './components/MobileLibrary'
import MobileNextBooks from './components/MobileNextBooks'
import MobileOpenPrompt from './components/MobileOpenPrompt'
import { useDialog } from './components/dialogContext'
import SearchWindow from './components/SearchWindow'
import LibraryProperties from './components/LibraryProperties'
import CreditsWindow from './components/CreditsWindow'
import DriveStatusToast from './components/DriveStatusToast'
import TrashWindow from './components/TrashWindow'
import PowerScreen from './components/PowerScreen'
import ShutdownDialog from './components/ShutdownDialog'
import TetrisWindow from './components/TetrisWindow'
import SaveStatusTray from './components/SaveStatusTray'
import ThemePicker from './components/ThemePicker'
import { readReviewDraft } from './utils/reviewDrafts'
import './App.css'
import './mobile.css' // App.css 뒤에 불러와야 모바일 덮어쓰기가 우선합니다
import './themes/theme-picker.css'
import './themes/liquid.css'

// 부팅 화면은 탭(세션)마다 처음 한 번만 보여 줍니다. 새로고침에는 다시 나오지 않습니다.
const BOOT_KEY = 'library98-booted'

export default function App() {
  const theme = useTheme()
  const isMobile = useIsMobile()
  // 모바일에서 켠 PC 화면 모드. 켜져 있으면 시작 메뉴에 "모바일 화면으로"를 보여 줍니다.
  const desktopMode = useDesktopMode()
  // 모바일은 파일을 조용히 다시 열 수 없어서, 연 서재의 사본을 브라우저에 보관해 다음에 바로 열게 합니다.
  const libraryDb = useLibraryDb({ rememberLast: isMobile || desktopMode })
  const { isReady, isDirty, saveLibrary, openLibrary } = libraryDb
  const { windows, openWindow, closeWindow: closeWindowNow, closeAll, focusWindow, toggleMinimize } =
    useWindowManager()
  const dialog = useDialog()
  const editorsRef = useRef(new Map())
  const closeWindow = async (id) => {
    const editor = editorsRef.current.get(id)
    if (editor && !(await editor.confirmClose())) return
    closeWindowNow(id)
  }

  // 전원 상태: 'booting'(시작 화면) → 'on' → 'shuttingDown' → 'off'(꺼진 화면) → 다시 'booting'
  const [power, setPower] = useState(() => {
    try {
      return sessionStorage.getItem(BOOT_KEY) ? 'on' : 'booting'
    } catch {
      return 'booting'
    }
  })
  const restartRef = useRef(false)
  // PowerScreen의 타이머/리스너가 매 렌더마다 다시 만들어지지 않도록 콜백을 고정합니다.
  const handleBooted = useCallback(() => {
    try {
      sessionStorage.setItem(BOOT_KEY, '1')
    } catch {
      // 저장소를 못 써도 부팅 화면만 다음에 또 나올 뿐입니다.
    }
    setPower('on')
  }, [])
  const handleShutdownDone = useCallback(
    () => setPower(restartRef.current ? 'booting' : 'off'),
    [],
  )
  const handleWake = useCallback(() => setPower('booting'), [])

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
      const active = windows.filter((w) => !w.minimized).reduce((top, w) => !top || w.zIndex > top.zIndex ? w : top, null)
      const editor = active && editorsRef.current.get(active.id)
      if (editor && !e.shiftKey) {
        editor.save()
        return
      }
      saveLibrary(e.shiftKey)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isReady, saveLibrary, windows])

  // Give new glass windows room for the larger controls; existing windows keep their geometry.
  const contentWindowSize = (width, height) => ({
    width,
    height: theme === 'liquid' ? Math.max(220, Math.min(height + 120, window.innerHeight - 130)) : height,
  })

  const openLibraryWindow = () =>
    openWindow('library', {
      title: '서재',
      icon: 'library',
      initialPosition: { x: 70, y: 50 },
      initialSize: contentWindowSize(920, 560),
    })

  // 랭킹/인용구 창에서 책을 누르면 서재 창을 열고 그 책으로 이동시킵니다. (모바일)
  const openLibraryAtBook = (bookId) =>
    openWindow('library', {
      title: '서재',
      icon: 'library',
      initialPosition: { x: 70, y: 50 },
      initialSize: contentWindowSize(920, 560),
      focus: { bookId, nonce: Date.now() },
    })

  // filter를 주면 검색 창이 그 저자/역자/출판사로 걸러진 상태로 열립니다. (이미 열려 있어도 갱신)
  const openSearchWindow = (filter) =>
    openWindow('search', {
      title: '검색',
      icon: 'search',
      initialPosition: { x: 110, y: 70 },
      initialSize: contentWindowSize(760, 540),
      ...(filter?.kind ? { filter } : {}),
    })

  const searchBy = (kind, name) => openSearchWindow({ kind, name, nonce: Date.now() })

  // 바탕화면 서재 아이콘의 "속성". Windows 속성 대화상자처럼 작은 팝업으로 띄웁니다.
  const openPropertiesWindow = () => {
    const width = Math.min(380, window.innerWidth - 24)
    openWindow('properties', {
      title: '서재 속성',
      icon: 'library',
      dialog: true,
      initialPosition: {
        x: Math.max(12, (window.innerWidth - width) / 2),
        y: Math.max(24, window.innerHeight / 2 - 210),
      },
      initialSize: { width, height: 0 },
    })
  }

  const openTrashWindow = () =>
    openWindow('trash', {
      title: '휴지통',
      icon: 'trash',
      initialPosition: { x: 140, y: 90 },
      initialSize: { width: 560, height: 420 },
    })

  // 종료 대화상자: Windows 98 알림창처럼 작은 팝업을 가운데쯤에 띄웁니다.
  const openShutdownDialog = () => {
    const width = Math.min(380, window.innerWidth - 24)
    openWindow('shutdown', {
      title: '서재 종료',
      icon: 'computer',
      dialog: true,
      initialPosition: {
        x: Math.max(12, (window.innerWidth - width) / 2),
        y: Math.max(24, window.innerHeight / 2 - 130),
      },
      initialSize: { width, height: 0 },
    })
  }

  // 종료/다시 시작: 열려 있던 창을 모두 닫고 화면을 덮습니다. 서재 데이터는 메모리에 그대로 남습니다.
  const handleShutdown = async (mode) => {
    for (const editor of [...editorsRef.current.values()]) {
      if (!(await editor.confirmClose())) return
    }
    restartRef.current = mode === 'restart'
    closeAll()
    setPower('shuttingDown')
  }

  const openReviewWindow = () =>
    openWindow('review', {
      title: '감상문 작성',
      icon: 'notepad',
      initialPosition: { x: 160, y: 120 },
      initialSize: { width: 640, height: 520 },
    })

  // 바탕화면 전용 게임. 시작 메뉴와 모바일에는 두지 않습니다.
  const openTetrisWindow = () =>
    openWindow('tetris', {
      title: '테트리스',
      icon: 'blocks',
      initialPosition: { x: 220, y: 60 },
      initialSize: { width: 400, height: 500 },
    })

  const openNextBooksWindow = () =>
    openWindow('next-books', {
      title: '다음 책',
      icon: 'bookmark',
      initialPosition: { x: 120, y: 80 },
      initialSize: contentWindowSize(760, 520),
    })

  const openBookshelfWindow = () =>
    openWindow('bookshelf', {
      title: '책장',
      icon: 'bookshelf',
      initialPosition: { x: 150, y: 60 },
      initialSize: contentWindowSize(820, 540),
    })

  // 시계를 빠르게 여러 번 누르면 나오는 크레딧(이스터에그)
  const openCreditsWindow = () => {
    const width = Math.min(340, window.innerWidth - 24)
    openWindow('credits', {
      title: 'Library98 정보',
      icon: 'library',
      dialog: true,
      initialPosition: {
        x: Math.max(12, (window.innerWidth - width) / 2),
        y: Math.max(24, window.innerHeight / 2 - 190),
      },
      initialSize: { width, height: 0 },
    })
  }

  // Windows 98 알림창처럼 작은 팝업을 화면 가운데쯤에 띄웁니다. PC와 모바일 모두 같습니다.
  const openQuoteOfDayWindow = () => {
    const width = Math.min(420, window.innerWidth - 24)
    openWindow('quote-of-day', {
      title: '오늘의 인용구',
      icon: 'quote',
      dialog: true,
      initialPosition: {
        x: Math.max(12, (window.innerWidth - width) / 2),
        y: Math.max(24, window.innerHeight / 2 - 150),
      },
      initialSize: { width, height: 0 }, // 대화상자는 높이를 내용에 맞추므로 폭만 씁니다
    })
  }

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
      icon: 'chart',
      initialPosition: { x: 100, y: 40 },
      initialSize: contentWindowSize(720, 580),
    })

  // 서재 창의 "감상문 추가/수정"은 인라인이 아니라 별도의 뜨는 창으로 엽니다.
  const openReviewEditWindow = (book, review, recoveryKey) => {
    if (recoveryKey) {
      const draft = readReviewDraft(recoveryKey)
      review = libraryDb.listReviews(book.id).find((r) => r.id === draft?.reviewId && r.createdAt === draft?.reviewCreatedAt) || null
    }
    const existing = windows.find((w) => w.id.startsWith('review-edit-') && w.librarySession === libraryDb.librarySession &&
      (review ? w.review?.id === review.id : recoveryKey ? w.recoveryKey === recoveryKey : w.bookId === book.id && !w.review))
    if (existing) {
      openWindow(existing.id)
      return
    }
    const id = `review-edit-${libraryDb.librarySession}-${crypto.randomUUID()}`
    const width = Math.min(900, window.innerWidth - 32)
    const height = Math.min(700, window.innerHeight - 90)
    openWindow(id, {
      title: `감상문 — ${book.title}`,
      icon: 'notepad',
      initialPosition: { x: Math.max(16, (window.innerWidth - width) / 2), y: 32 },
      initialSize: { width, height },
      librarySession: libraryDb.librarySession,
      recoveryKey,
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
      icon: 'book-open',
      initialPosition: { x: 180 + cascade, y: 90 + cascade },
      initialSize: { width: 560, height: 480 },
      bookId: book.id,
      bookTitle: book.title,
      reviewId: review.id,
    })
  }

  // 서재 창 메뉴바의 보기/도움말 메뉴가 다른 창을 이름으로 엽니다.
  const openWindowByName = (name) =>
    ({
      search: () => openSearchWindow(),
      'next-books': openNextBooksWindow,
      bookshelf: openBookshelfWindow,
      stats: openStatsWindow,
      quote: openQuoteOfDayWindow,
      trash: openTrashWindow,
      properties: openPropertiesWindow,
    })[name]?.()

  const handleSaveIcon = () => {
    if (!isReady) {
      dialog.alert('먼저 "서재" 아이콘으로 서재를 열거나 새로 만들어주세요.', { title: '서재 저장' })
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

  const openThemeWindow = () => {
    const width = Math.min(480, window.innerWidth - 24)
    openWindow('appearance', {
      title: '화면 테마', icon: 'palette', dialog: true,
      initialPosition: { x: Math.max(12, (window.innerWidth - width) / 2), y: Math.max(24, (window.innerHeight - 380) / 2) },
      initialSize: { width, height: 0 },
    })
  }

  const startMenuItems = [
    { icon: 'library', label: '서재', onClick: openLibraryWindow },
    { icon: 'bookshelf', label: '책장', onClick: openBookshelfWindow },
    { icon: 'search', label: '검색', onClick: () => openSearchWindow() },
    { icon: 'bookmark', label: '다음 책', onClick: openNextBooksWindow },
    { icon: 'chart', label: '독서 통계', onClick: openStatsWindow },
    { icon: 'quote', label: '오늘의 인용구', onClick: openQuoteOfDayWindow },
    { separator: true },
    { icon: 'document-new', label: '새 서재 만들기', onClick: libraryDb.newLibrary },
    { icon: 'folder-open', label: '서재 불러오기', onClick: openLibrary },
    { icon: 'floppy', label: '서재 저장', onClick: handleSaveIcon },
    ...(libraryDb.driveSupported
      ? [
          { separator: true },
          { icon: 'folder-open', label: 'Google Drive에서 불러오기', onClick: libraryDb.openFromDrive },
          { icon: 'floppy', label: 'Google Drive에 저장', onClick: libraryDb.saveToDrive },
        ]
      : []),
    { separator: true },
    ...(desktopMode ? [{ icon: 'computer', label: '모바일 화면으로', onClick: () => setDesktopMode(false) }] : []),
    { icon: 'palette', label: '화면 테마', onClick: openThemeWindow },
    { icon: 'computer', label: '시스템 종료...', onClick: openShutdownDialog },
  ]

  // 모바일: 서재/랭킹/통계/인용구 창은 읽기 전용 화면으로 보여 줍니다.
  const mobileMenuItems = [
    { icon: 'library', label: '서재', onClick: openLibraryWindow },
    { icon: 'bookshelf', label: '책장', onClick: openBookshelfWindow },
    { icon: 'search', label: '검색', onClick: () => openSearchWindow() },
    { icon: 'bookmark', label: '다음 책', onClick: openNextBooksWindow },
    { icon: 'chart', label: '독서 통계', onClick: openStatsWindow },
    { icon: 'quote', label: '오늘의 인용구', onClick: openQuoteOfDayWindow },
    { separator: true },
    { icon: 'folder-open', label: '서재 파일 열기', onClick: openLibrary },
    ...(libraryDb.driveSupported
      ? [{ icon: 'folder-open', label: 'Google Drive에서 불러오기', onClick: libraryDb.openFromDrive }]
      : []),
    ...(libraryDb.lastLibrary
      ? [{ icon: 'book-open', label: '마지막 서재 불러오기', onClick: libraryDb.restoreLastLibrary }]
      : []),
    { separator: true },
    { icon: 'computer', label: 'PC 화면으로', onClick: () => setDesktopMode(true) },
    { icon: 'palette', label: '화면 테마', onClick: openThemeWindow },
    { icon: 'computer', label: '시스템 종료...', onClick: openShutdownDialog },
  ]

  const renderMobileContent = (w) => {
    if (!['library', 'next-books', 'stats'].includes(w.id)) return undefined

    if (!libraryDb.isReady) {
      return (
        <div className="m-content">
          <MobileOpenPrompt
            busy={libraryDb.busy}
            error={libraryDb.error}
            lastLibrary={libraryDb.lastLibrary}
            openLibrary={openLibrary}
            openFromDrive={libraryDb.openFromDrive}
            driveSupported={libraryDb.driveSupported}
            restoreLastLibrary={libraryDb.restoreLastLibrary}
          />
        </div>
      )
    }

    let content = null
    if (w.id === 'library') {
      content = (
        <MobileLibrary
          books={libraryDb.books}
          readings={libraryDb.readings}
          quotes={libraryDb.quotes}
          listReviews={libraryDb.listReviews}
          focus={w.focus}
          onViewReview={openReviewViewWindow}
          onSearchBy={searchBy}
        />
      )
    } else if (w.id === 'next-books') {
      content = (
        <MobileNextBooks
          books={libraryDb.books}
          nextBookIds={libraryDb.nextBookIds}
          onOpenBook={openLibraryAtBook}
        />
      )
    } else if (w.id === 'stats') {
      content = (
        <StatsWindow
          isReady
          books={libraryDb.books}
          readings={libraryDb.readings}
          getReviewCounts={libraryDb.getReviewCounts}
          reviewsVersion={libraryDb.reviewsVersion}
          onSearchBy={searchBy}
        />
      )
    }
    return <div className="m-content">{content}</div>
  }

  const renderWindowContent = (w) => {
    if (w.id === 'appearance') return <ThemePicker />
    if (isMobile) {
      const mobileContent = renderMobileContent(w)
      if (mobileContent !== undefined) return mobileContent
    }

    if (w.id === 'library') {
      return <LibraryWindow {...libraryDb} focus={w.focus}
          onOpenWindow={openWindowByName}
          onCloseWindow={() => closeWindow(w.id)} onOpenReviewWindow={openReviewEditWindow}
          onViewReview={openReviewViewWindow}
          onSearchBy={searchBy}
        />
    }
    if (w.id === 'review') {
      return (
        <ReviewQuickWindow
          key={libraryDb.librarySession}
          isReady={libraryDb.isReady}
          books={libraryDb.books}
          libraryId={libraryDb.libraryId}
          listReviews={libraryDb.listReviews}
          addOrUpdateBook={libraryDb.addOrUpdateBook}
          onOpenReview={openReviewEditWindow}
          onOpenLibrary={openLibraryWindow}
        />
      )
    }
    if (w.id === 'tetris') {
      return (
        <TetrisWindow
          active={w.id === activeId}
          quotes={libraryDb.quotes}
          books={libraryDb.books}
        />
      )
    }
    if (w.id === 'shutdown') {
      return (
        <ShutdownDialog
          isDirty={isDirty}
          busy={libraryDb.busy}
          onSave={() => saveLibrary(false)}
          onConfirm={handleShutdown}
          onCancel={() => closeWindow(w.id)}
        />
      )
    }
    if (w.id === 'trash') {
      return (
        <TrashWindow
          isReady={libraryDb.isReady}
          trashedBooks={libraryDb.trashedBooks}
          restoreBook={libraryDb.restoreBook}
          purgeBook={libraryDb.purgeBook}
          emptyTrash={libraryDb.emptyTrash}
          onOpenLibrary={openLibraryWindow}
          onClose={() => closeWindow(w.id)}
        />
      )
    }
    if (w.id === 'search') {
      return (
        <SearchWindow
          isReady={libraryDb.isReady}
          books={libraryDb.books}
          quotes={libraryDb.quotes}
          listAllReviews={libraryDb.listAllReviews}
          reviewsVersion={libraryDb.reviewsVersion}
          onOpenLibrary={isMobile ? openLibrary : openLibraryWindow}
          onOpenBook={openLibraryAtBook}
          onOpenReview={openReviewViewWindow}
          filter={w.filter}
          onClose={() => closeWindow(w.id)}
        />
      )
    }
    if (w.id === 'properties') {
      return (
        <LibraryProperties
          isReady={libraryDb.isReady}
          fileName={libraryDb.fileName}
          saveTarget={libraryDb.saveTarget}
          isDirty={libraryDb.isDirty}
          lastSaved={libraryDb.lastSaved}
          books={libraryDb.books}
          trashedBooks={libraryDb.trashedBooks}
          readings={libraryDb.readings}
          quotes={libraryDb.quotes}
          nextBookIds={libraryDb.nextBookIds}
          reviewsVersion={libraryDb.reviewsVersion}
          getDbInfo={libraryDb.getDbInfo}
          onClose={() => closeWindow(w.id)}
        />
      )
    }
    if (w.id === 'credits') {
      return (
        <CreditsWindow
          bookCount={isReady ? libraryDb.books.length : null}
          quoteCount={libraryDb.quotes.length}
          onClose={() => closeWindow(w.id)}
        />
      )
    }
    if (w.id === 'quote-of-day') {
      return (
        <QuoteOfDayWindow
          isReady={libraryDb.isReady}
          books={libraryDb.books}
          quotes={libraryDb.quotes}
          onOpenLibrary={isMobile ? openLibrary : openLibraryWindow}
          onClose={() => closeWindow(w.id)}
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
          onSearchBy={searchBy}
          onClose={() => closeWindow(w.id)}
        />
      )
    }
    if (w.id === 'next-books') {
      return (
        <NextBooksWindow
          isReady={libraryDb.isReady}
          books={libraryDb.books}
          nextBookIds={libraryDb.nextBookIds}
          saveNextBooks={libraryDb.saveNextBooks}
          onOpenLibrary={openLibraryWindow}
          onOpenBook={openLibraryAtBook}
          onClose={() => closeWindow(w.id)}
        />
      )
    }
    if (w.id === 'bookshelf') {
      return (
        <BookshelfWindow
          isReady={libraryDb.isReady}
          books={libraryDb.books}
          fillBookPrices={libraryDb.fillBookPrices}
          onOpenLibrary={isMobile ? openLibrary : openLibraryWindow}
          onOpenBook={openLibraryAtBook}
          onClose={isMobile ? undefined : () => closeWindow(w.id)}
        />
      )
    }
    if (w.id.startsWith('review-view-')) {
      const review = libraryDb.listReviews(w.bookId).find((r) => r.id === w.reviewId) || null
      const view = (
        <ReviewViewWindow
          bookTitle={w.bookTitle}
          review={review}
          onEdit={
            isMobile
              ? undefined // 모바일은 읽기 전용
              : () => openReviewEditWindow({ id: w.bookId, title: w.bookTitle }, review)
          }
        />
      )
      return isMobile ? <div className="m-content m-reader">{view}</div> : view
    }
    if (w.id.startsWith('review-edit-')) {
      if (w.librarySession !== libraryDb.librarySession) {
        return <p>서재가 바뀌었습니다. 원래 서재를 열고 같은 책에서 초안을 이어 써 주세요.</p>
      }
      const book = libraryDb.books.find((b) => b.id === w.bookId)
      if (!book) return <p>책이 삭제되었습니다. 초안은 보관됩니다. 책을 복원한 뒤 다시 열어 주세요.</p>
      return (
        <ReviewEditWindow
          book={book}
          libraryId={libraryDb.libraryId}
          listReviews={libraryDb.listReviews}
          quotes={libraryDb.quotes}
          review={w.review}
          recoveryKey={w.recoveryKey}
          saveReview={libraryDb.saveReview}
          onDone={() => closeWindow(w.id)}
          onSaved={(review) => openWindow(w.id, { review })}
          registerEditor={(editor) => {
            editorsRef.current.set(w.id, editor)
            return () => editorsRef.current.delete(w.id)
          }}
        />
      )
    }
    return null
  }

  // 최소화되지 않은 창 중 가장 앞에 있는 창이 "활성" 창입니다.
  const activeId = windows
    .filter((w) => !w.minimized)
    .reduce((top, w) => (top === null || w.zIndex > top.zIndex ? w : top), null)?.id

  return (
    <>
    {/* 부팅/종료 화면이 덮여 있는 동안 뒤의 바탕화면은 키보드/스크린리더로도 조작되지 않게 합니다. */}
    <div className={`desktop${isMobile ? ' is-mobile' : ''}`} inert={power !== 'on'}>
      <div className="desktop__icons">
        {isMobile ? (
          // 모바일: 한 번 탭으로 실행하고, 읽기 위주의 아이콘만 둡니다.
          <>
            {!isReady && libraryDb.lastLibrary && (
              <DesktopIcon
                icon="book-open"
                label="마지막 서재"
                onActivate={libraryDb.restoreLastLibrary}
                tapToOpen
              />
            )}
            <DesktopIcon icon="folder-open" label="서재 열기" onActivate={openLibrary} tapToOpen />
            <DesktopIcon icon="library" label="서재" onActivate={openLibraryWindow} tapToOpen />
            <DesktopIcon icon="bookshelf" label="책장" onActivate={openBookshelfWindow} tapToOpen />
            <DesktopIcon icon="bookmark" label="다음 책" onActivate={openNextBooksWindow} tapToOpen />
            <DesktopIcon icon="chart" label="통계" onActivate={openStatsWindow} tapToOpen />
            <DesktopIcon icon="quote" label="인용구" onActivate={openQuoteOfDayWindow} tapToOpen />
          </>
        ) : (
          // PC 화면 모드(터치 기기)에서는 두 번 탭이 확대로 먹히므로 한 번 탭으로 실행합니다.
          // 서재 저장/불러오기는 시작 메뉴와 서재 창의 파일 메뉴에 있습니다. 휴지통은 맨 아래에 둡니다.
          <>
            <DesktopIcon
              icon="library"
              label="서재"
              onActivate={openLibraryWindow}
              tapToOpen={desktopMode}
              contextItems={[
                { label: '열기', bold: true, onClick: openLibraryWindow },
                { separator: true },
                { label: '속성', onClick: openPropertiesWindow },
              ]}
            />
            <DesktopIcon icon="bookshelf" label="책장" onActivate={openBookshelfWindow} tapToOpen={desktopMode} />
            <DesktopIcon icon="notepad" label="감상문" onActivate={openReviewWindow} tapToOpen={desktopMode} />
            <DesktopIcon icon="blocks" label="테트리스" onActivate={openTetrisWindow} tapToOpen={desktopMode} />
            <DesktopIcon
              icon={libraryDb.trashedBooks.length ? 'trash-full' : 'trash'}
              label={libraryDb.trashedBooks.length ? `휴지통 (${libraryDb.trashedBooks.length})` : '휴지통'}
              onActivate={openTrashWindow}
              tapToOpen={desktopMode}
            />
          </>
        )}
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
          active={w.id === activeId}
          maximized={isMobile}
          dialog={w.dialog}
          onClose={() => closeWindow(w.id)}
          onMinimize={() => toggleMinimize(w.id)}
          onFocus={() => focusWindow(w.id)}
        >
          {renderWindowContent(w)}
        </Window>
      ))}

      <Taskbar windows={windows} activeId={activeId} onToggle={handleToggleFromTaskbar} menuItems={isMobile ? mobileMenuItems : startMenuItems}
        onOpenTheme={openThemeWindow}
        onClockEasterEgg={openCreditsWindow}
        tray={
          // 모바일은 읽기 전용이라 저장 상태를 보여 주지 않습니다.
          !isMobile && (
            <SaveStatusTray
              isReady={isReady}
              isDirty={isDirty}
              busy={libraryDb.busy}
              lastSaved={libraryDb.lastSaved}
              canAutoSave={libraryDb.canAutoSave}
              fsaSupported={libraryDb.fsaSupported}
              driveSupported={libraryDb.driveSupported}
              onSave={() => saveLibrary(false)}
            />
          )
        }
      />
    </div>

    <DriveStatusToast status={libraryDb.driveStatus} onDismiss={libraryDb.dismissDriveStatus} />

    <PowerScreen
      state={power}
      restart={restartRef.current}
      onBooted={handleBooted}
      onShutdownDone={handleShutdownDone}
      onWake={handleWake}
    />
    </>
  )
}
