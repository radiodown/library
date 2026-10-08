const PATHS = {
  library: 'M4 4h5v16H4z M10 4h5v16h-5z M16 5l4-1 3 15-4 1z M6 7h1 M12 7h1',
  bookshelf: 'M3 3v18 M21 3v18 M3 12h18 M3 21h18 M6 4v7 M10 4v7 M14 5l3 6 M7 15v5 M12 15v5 M17 14v6',
  'book-open': 'M12 5v15 M12 5C8 2 3 3 3 3v16s5-1 9 1c4-2 9-1 9-1V3s-5-1-9 2z',
  'folder-open': 'M3 8V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2 M3 8h18l-3 12H3z',
  floppy: 'M5 3h12l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M7 3v6h9V3 M7 21v-8h10v8 M14 5v2',
  notepad: 'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M8 7h8 M8 11h8 M8 15h5',
  'document-new': 'M14 3H5v18h14V8z M14 3v5h5 M12 11v6 M9 14h6',
  pencil: 'M15 4l5 5 M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15z',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z M16 16l5 5',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  chart: 'M3 3v18h18 M7 16v-5 M12 16V6 M17 16V9',
  quote: 'M4 5h16v12H9l-5 4z M8 9h2v3H7V9l1-2 M15 9h2v3h-3V9l1-2',
  computer: 'M3 3h18v13H3z M12 16v5 M7 21h10',
  warning: 'M12 3l10 18H2z M12 9v5 M12 17v.1',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h1 M12 14h1 M16 14h1 M8 17h1 M12 17h1',
  blocks: 'M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z',
  trophy: 'M7 3h10v8a5 5 0 0 1-10 0z M7 5H3v4a4 4 0 0 0 4 4 M17 5h4v4a4 4 0 0 1-4 4 M12 16v5 M8 21h8',
  palette: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4 2 2 0 0 1 1-4h3a3 3 0 0 0 3-3 9 9 0 0 0-9-7z M7 9v.1 M10 6v.1 M15 7v.1 M17 10v.1',
  'arrow-left': 'M20 12H4 M10 6l-6 6 6 6',
  'arrow-right': 'M4 12h16 M14 6l6 6-6 6',
  'arrow-up': 'M12 20V4 M6 10l6-6 6 6',
  'arrow-down': 'M12 4v16 M6 14l6 6 6-6',
  'sort-asc': 'M5 3v18 M2 18l3 3 3-3 M12 6h4 M12 12h7 M12 18h10',
  'sort-desc': 'M5 3v18 M2 18l3 3 3-3 M12 6h10 M12 12h7 M12 18h4',
}

const ALIASES = {
  'trash-full': 'trash', 'document-edit': 'pencil', 'document-save': 'floppy',
  'trash-lid': 'trash', 'book-read': 'book-open', 'book-new': 'library', 'book-marked': 'bookmark', 'book-star': 'trophy',
  'book-closed': 'library', 'folder': 'folder-open', 'file': 'notepad',
  'status-reading': 'book-open', 'status-finished': 'bookmark', 'status-wishlist': 'bookmark',
}

export default function ModernIcon({ name, size = 16, className = '' }) {
  const path = PATHS[ALIASES[name] || name] || 'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5'
  return (
    <svg className={`pixel-icon modern-icon ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  )
}
