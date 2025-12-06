'use client'

import { useDroppable } from '@dnd-kit/core'
import { Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CanvasDropZoneProps {
  id: string
  isEmpty: boolean
  children?: React.ReactNode
}

export function CanvasDropZone({ id, isEmpty, children }: CanvasDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 rounded-lg transition-colors min-h-[300px]',
        isEmpty
          ? 'border-2 border-dashed flex items-center justify-center'
          : 'border bg-card/50',
        isOver
          ? 'border-primary bg-primary/5 border-solid'
          : 'border-muted-foreground/25 bg-muted/30'
      )}
    >
      {isEmpty ? (
        <div className="text-center text-muted-foreground">
          <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Tile Canvas</p>
          <p className="text-xs mt-1">
            Drag products here to create tiles
          </p>
          {isOver && (
            <p className="text-xs mt-2 text-primary font-medium">
              Drop to add to canvas
            </p>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  )
}
