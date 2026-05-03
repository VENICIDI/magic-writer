import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'mw-theme'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  return stored || 'dark'
}

// 立即在模块加载时设置（避免闪烁）
const initial = getInitialTheme()
document.documentElement.setAttribute('data-theme', initial)

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(initial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = (t: Theme): void => {
    setThemeState(t)
  }

  const toggleTheme = (): void => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return { theme, setTheme, toggleTheme }
}
