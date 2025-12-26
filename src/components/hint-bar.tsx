'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Lightbulb, Command } from 'lucide-react'
import { cn } from '@fossapp/ui'
import { hints, type Hint } from '@/data/hints'

const ROTATION_INTERVAL = 12000 // 12 seconds
const STORAGE_KEY = 'fossapp-hints-seen'
const SESSION_DISMISSED_KEY = 'fossapp-hints-dismissed'

export function HintBar() {
  const [currentHintIndex, setCurrentHintIndex] = useState(0)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [orderedHints, setOrderedHints] = useState<Hint[]>(hints)

  // Initialize: check if dismissed this session, order hints by seen status
  useEffect(() => {
    // Check session dismissal
    const dismissed = sessionStorage.getItem(SESSION_DISMISSED_KEY)
    if (dismissed === 'true') {
      setIsDismissed(true)
      return
    }

    // Get seen hints and order unseen first, newest first
    const seenHints = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]
    const unseen = hints.filter(h => !seenHints.includes(h.id))
    const seen = hints.filter(h => seenHints.includes(h.id))

    // Sort by dateAdded (newest first), then shuffle within same date
    const sortByDate = (a: Hint, b: Hint) =>
      new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()

    const sortedUnseen = unseen.sort(sortByDate)
    const sortedSeen = seen.sort(sortByDate)

    setOrderedHints([...sortedUnseen, ...sortedSeen])
    setIsVisible(true)
  }, [])

  // Mark current hint as seen
  const markAsSeen = useCallback((hintId: string) => {
    const seenHints = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]
    if (!seenHints.includes(hintId)) {
      seenHints.push(hintId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seenHints))
    }
  }, [])

  // Rotate hints
  useEffect(() => {
    if (isDismissed || !isVisible) return

    // Mark initial hint as seen
    markAsSeen(orderedHints[0]?.id)

    const interval = setInterval(() => {
      setCurrentHintIndex(prev => {
        const nextIndex = (prev + 1) % orderedHints.length
        markAsSeen(orderedHints[nextIndex]?.id)
        return nextIndex
      })
    }, ROTATION_INTERVAL)

    return () => clearInterval(interval)
  }, [isDismissed, isVisible, orderedHints, markAsSeen])

  const handleDismiss = () => {
    setIsDismissed(true)
    sessionStorage.setItem(SESSION_DISMISSED_KEY, 'true')
  }

  if (isDismissed || !isVisible || orderedHints.length === 0) {
    return null
  }

  const currentHint = orderedHints[currentHintIndex]

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 px-4 py-2.5 mb-6 rounded-lg',
      'bg-primary/5 border border-primary/20',
      'animate-in fade-in slide-in-from-top-2 duration-300'
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 p-1.5 rounded-md bg-primary/10">
          {currentHint.icon === 'keyboard' ? (
            <Command className="h-4 w-4 text-primary" />
          ) : (
            <Lightbulb className="h-4 w-4 text-primary" />
          )}
        </div>
        <p className="text-sm text-foreground/80 truncate">
          {currentHint.text}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Progress dots - clickable */}
        <div className="hidden sm:flex items-center gap-1">
          {orderedHints.slice(0, 5).map((hint, idx) => (
            <button
              key={hint.id}
              onClick={() => {
                setCurrentHintIndex(idx)
                markAsSeen(hint.id)
              }}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors hover:bg-primary/70',
                idx === currentHintIndex % 5 ? 'bg-primary' : 'bg-primary/30'
              )}
              aria-label={`Show hint ${idx + 1}`}
            />
          ))}
        </div>

        <button
          onClick={handleDismiss}
          className="p-1 rounded hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Dismiss hints"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
