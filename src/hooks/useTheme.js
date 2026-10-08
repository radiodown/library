import { useSyncExternalStore } from 'react'

export const THEME_KEY = 'library:theme'
const THEMES = new Set(['classic', 'liquid'])
const listeners = new Set()

function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return THEMES.has(saved) ? saved : 'classic'
  } catch {
    return 'classic'
  }
}

let theme = readTheme()

function applyTheme() {
  document.documentElement.dataset.theme = theme
}

// Apply before React mounts, including dialogs rendered outside App.
applyTheme()

export function setTheme(next) {
  if (!THEMES.has(next)) return
  theme = next
  applyTheme()
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {
    // Switching still works for this tab when browser storage is unavailable.
  }
  listeners.forEach((listener) => listener())
}

function handleStorage(event) {
  if (event.key !== THEME_KEY && event.key !== null) return
  theme = readTheme()
  applyTheme()
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  if (listeners.size === 0) window.addEventListener('storage', handleStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', handleStorage)
  }
}

export function useTheme() {
  return useSyncExternalStore(subscribe, () => theme, () => 'classic')
}
