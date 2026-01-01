'use client'

import { Button } from '@fossapp/ui'
import { X } from 'lucide-react'

interface StatusBarProps {
  x: number
  y: number
  mode: string | null
  onCancel: () => void
}

export function StatusBar({ x, y, mode, onCancel }: StatusBarProps) {
  return (
    <div className="flex items-center gap-4 border-t bg-muted/50 px-4 py-1.5 text-xs">
      {/* Coordinates */}
      <div className="flex gap-4 font-mono">
        <span>
          X: <span className="text-foreground">{x.toFixed(2)}</span>
        </span>
        <span>
          Y: <span className="text-foreground">{y.toFixed(2)}</span>
        </span>
        <span className="text-muted-foreground">mm</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Mode indicator */}
      {mode && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Mode:</span>
          <span className="font-medium text-primary">{mode}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onCancel}
          >
            <X className="h-3 w-3" />
          </Button>
          <span className="text-muted-foreground">[Esc]</span>
        </div>
      )}
    </div>
  )
}
