'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { FaSun, FaMoon, FaDesktop } from 'react-icons/fa'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])


  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
    )
  }

  const themes = [
    { name: 'Light', value: 'light', icon: FaSun },
    { name: 'Dark', value: 'dark', icon: FaMoon },
    { name: 'System', value: 'system', icon: FaDesktop },
  ]

  const currentTheme = themes.find(t => t.value === theme) || themes[2]
  const CurrentIcon = currentTheme.icon

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
        aria-label={`Current theme: ${currentTheme.name}`}
        title={`Current theme: ${currentTheme.name}. Click to change.`}
      >
        <CurrentIcon className="h-4 w-4 text-secondary-foreground" />
      </button>

      {dropdownOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setDropdownOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-32 bg-popover rounded-md shadow-lg py-1 z-20 border">
            {themes.map((themeOption) => {
              const Icon = themeOption.icon
              return (
                <button
                  key={themeOption.value}
                  onClick={() => {
                    setTheme(themeOption.value)
                    setDropdownOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors ${
                    theme === themeOption.value
                      ? 'text-primary bg-primary/10'
                      : 'text-popover-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {themeOption.name}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}