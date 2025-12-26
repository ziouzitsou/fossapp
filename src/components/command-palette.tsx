'use client'

import { useEffect, useState } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@fossapp/ui'
import { DialogTitle } from '@fossapp/ui'
import { FaHistory, FaClock } from 'react-icons/fa'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  searchHistory: string[]
  onSearch: (query: string) => void
  placeholder?: string
  emptyMessage?: string
}

export function CommandPalette({
  open,
  onOpenChange,
  searchHistory,
  onSearch,
  placeholder = 'Search...',
  emptyMessage = 'No results found.',
}: CommandPaletteProps) {
  const [search, setSearch] = useState('')

  // Handle search selection
  const handleSelect = (value: string) => {
    onSearch(value)
    onOpenChange(false)
    setSearch('')
  }

  // Handle Enter key to search current input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim()) {
      handleSelect(search)
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">Search</DialogTitle>
      <CommandInput
        placeholder={placeholder}
        value={search}
        onValueChange={setSearch}
        onKeyDown={handleKeyDown}
      />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>

        {searchHistory.length > 0 && (
          <>
            <CommandGroup heading="Recent Searches">
              {searchHistory.map((term, index) => (
                <CommandItem
                  key={`${term}-${index}`}
                  value={term}
                  onSelect={handleSelect}
                >
                  <FaClock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{term}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {search.trim() && (
          <>
            {searchHistory.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Search for">
              <CommandItem
                value={search}
                onSelect={handleSelect}
              >
                <FaHistory className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>&quot;{search}&quot;</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return { open, setOpen }
}
