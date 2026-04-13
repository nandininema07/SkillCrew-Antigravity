'use client'

import * as React from 'react'

type Theme = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

interface ThemeProviderProps {
  children: React.ReactNode
  attribute?: string
  defaultTheme?: Theme
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

function getPreferredTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme, attribute: string) {
  const root = document.documentElement
  const resolvedTheme =
    theme === 'system' ? getPreferredTheme() : theme

  if (attribute === 'class') {
    root.classList.toggle('dark', resolvedTheme === 'dark')
  } else {
    root.setAttribute(attribute, resolvedTheme)
  }

  return resolvedTheme
}

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'system',
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>(
    defaultTheme === 'dark' ? 'dark' : 'light'
  )
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    const storedTheme = window.localStorage.getItem('theme') as Theme | null
    const initialTheme = storedTheme ?? defaultTheme
    setTheme(initialTheme)
    setMounted(true)
  }, [defaultTheme])

  React.useEffect(() => {
    if (!mounted) {
      return
    }

    const root = document.documentElement
    const previousTransition = root.style.transition

    if (disableTransitionOnChange) {
      root.style.transition = 'none'
    }

    const nextResolvedTheme =
      theme === 'system' && enableSystem ? getPreferredTheme() : theme === 'system' ? 'light' : theme

    applyTheme(theme, attribute)
    setResolvedTheme(nextResolvedTheme)
    window.localStorage.setItem('theme', theme)

    if (disableTransitionOnChange) {
      window.requestAnimationFrame(() => {
        root.style.transition = previousTransition
      })
    }
  }, [attribute, disableTransitionOnChange, enableSystem, mounted, theme])

  React.useEffect(() => {
    if (!mounted || theme !== 'system' || !enableSystem) {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => {
      const currentTheme = event.matches ? 'dark' : 'light'
      setResolvedTheme(currentTheme)
      if (attribute === 'class') {
        document.documentElement.classList.toggle('dark', currentTheme === 'dark')
      } else {
        document.documentElement.setAttribute(attribute, currentTheme)
      }
    }

    mediaQuery.addEventListener?.('change', handler)
    mediaQuery.addListener?.(handler)

    return () => {
      mediaQuery.removeEventListener?.('change', handler)
      mediaQuery.removeListener?.(handler)
    }
  }, [attribute, enableSystem, mounted, theme])

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = React.useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}
