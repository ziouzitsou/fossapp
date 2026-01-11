'use client'

/**
 * ViewerQuickActions - Quick action buttons in viewer top-right
 *
 * Provides one-click access to common viewer operations like Fit All.
 */

import { Maximize } from 'lucide-react'
import { Button } from '@fossapp/ui'

export interface ViewerQuickActionsProps {
  /** Callback to fit all geometry in view */
  onFitAll: () => void
}

/**
 * ViewerQuickActions - Quick action buttons
 */
export function ViewerQuickActions({ onFitAll }: ViewerQuickActionsProps) {
  return (
    <div className="absolute top-3 right-3 z-20 flex gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 bg-background/85 backdrop-blur-sm border-border/50 shadow-sm hover:bg-accent"
        onClick={onFitAll}
        title="Fit All (zoom to show entire drawing)"
      >
        <Maximize className="h-4 w-4" />
      </Button>
    </div>
  )
}
