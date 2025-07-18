import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

// Get initial theme synchronously to prevent flicker
function getInitialTheme(storageKey: string, defaultTheme: Theme): Theme {
  if (typeof window === 'undefined') return defaultTheme

  try {
    const stored = localStorage.getItem(storageKey)
    return (stored as Theme) || defaultTheme
  } catch {
    return defaultTheme
  }
}

// Apply theme to document root
function applyTheme(theme: Theme) {
  const root = window.document.documentElement

  // Remove existing theme classes
  root.classList.remove('light', 'dark')

  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    root.classList.add(systemTheme)
  } else {
    root.classList.add(theme)
  }
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'deepcut-theme',
  ...props
}: ThemeProviderProps) {
  // Initialize theme synchronously to match what was set in index.html
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme(storageKey, defaultTheme))

  useEffect(() => {
    // Apply theme on mount and when theme changes
    applyTheme(theme)
  }, [theme])

  // Listen for system theme changes when using system theme
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      try {
        localStorage.setItem(storageKey, newTheme)
      } catch {
        // Handle localStorage errors gracefully
      }
      setTheme(newTheme)
    }
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
