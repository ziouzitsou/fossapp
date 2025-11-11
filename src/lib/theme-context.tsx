'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'default' | 'supabase' | 'graphite'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function MultiThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('default')
  const [mounted, setMounted] = useState(false)

  // Load theme from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('app-theme') as Theme | null
    if (savedTheme && ['default', 'supabase', 'graphite'].includes(savedTheme)) {
      setThemeState(savedTheme)
    }
  }, [])

  // Apply theme class to document root
  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement

    // Remove all theme classes
    root.classList.remove('theme-supabase', 'theme-graphite')

    // Add new theme class (default has no class, uses :root)
    if (theme === 'supabase') {
      root.classList.add('theme-supabase')
    } else if (theme === 'graphite') {
      root.classList.add('theme-graphite')
    }
  }, [theme, mounted])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('app-theme', newTheme)
  }

  // Avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useMultiTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useMultiTheme must be used within MultiThemeProvider')
  }
  return context
}
