'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { SearchModal } from './search-modal'

interface GlobalSearchContextType {
  isOpen: boolean
  openSearch: () => void
  closeSearch: () => void
}

const GlobalSearchContext = createContext<GlobalSearchContextType | null>(null)

export function useGlobalSearch() {
  const context = useContext(GlobalSearchContext)
  if (!context) {
    throw new Error('useGlobalSearch must be used within GlobalSearchProvider')
  }
  return context
}

interface GlobalSearchProviderProps {
  children: ReactNode
}

export function GlobalSearchProvider({ children }: GlobalSearchProviderProps) {
  const [isOpen, setIsOpen] = useState(false)

  const openSearch = useCallback(() => setIsOpen(true), [])
  const closeSearch = useCallback(() => setIsOpen(false), [])

  // Check if another modal/dialog is open
  const isOtherModalOpen = useCallback(() => {
    // Check for open radix dialogs (shadcn uses radix)
    const openDialogs = document.querySelectorAll('[data-state="open"][role="dialog"]')
    // Filter out our own search modal
    const otherModals = Array.from(openDialogs).filter(
      (el) => !el.closest('[data-global-search]')
    )
    return otherModals.length > 0
  }, [])

  // Check if user is typing in an input
  const isInputFocused = useCallback(() => {
    const activeElement = document.activeElement
    if (!activeElement) return false

    const tagName = activeElement.tagName.toLowerCase()
    const isEditable = activeElement.getAttribute('contenteditable') === 'true'
    const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select'

    return isInput || isEditable
  }, [])

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger on "/" key
      if (e.key !== '/') return

      // Don't trigger if user is typing in an input
      if (isInputFocused()) return

      // Don't trigger if another modal is open
      if (isOtherModalOpen()) return

      // Don't trigger if modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // Prevent "/" from being typed
      e.preventDefault()

      // Open the search modal
      openSearch()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isInputFocused, isOtherModalOpen, openSearch])

  return (
    <GlobalSearchContext.Provider value={{ isOpen, openSearch, closeSearch }}>
      {children}
      <div data-global-search>
        <SearchModal open={isOpen} onOpenChange={setIsOpen} />
      </div>
    </GlobalSearchContext.Provider>
  )
}
