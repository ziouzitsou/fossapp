'use client'

/**
 * ModeIndicator - Badge showing current viewer interaction mode
 *
 * Positioned at top-center of the viewer canvas, similar to AutoCAD's command line.
 * Shows the current mode with an icon and optional product info for PLACEMENT mode.
 */

import { MousePointer2, Ruler, Target, Hand, Move } from 'lucide-react'
import { cn } from '@fossapp/ui'
import type { ViewerMode } from '../types'

/**
 * Mode configuration for display
 */
const MODE_CONFIG: Record<ViewerMode, {
  label: string
  icon: React.ElementType
  colorClass: string
  bgClass: string
  description: string
}> = {
  IDLE: {
    label: 'IDLE',
    icon: Hand,
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted/50 border-border/50',
    description: 'Pan & zoom navigation',
  },
  SELECT: {
    label: 'SELECT',
    icon: MousePointer2,
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    description: 'Click markers to select',
  },
  MEASUREMENT: {
    label: 'MEASURE',
    icon: Ruler,
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    description: 'Measure distances',
  },
  PLACEMENT: {
    label: 'PLACEMENT',
    icon: Target,
    colorClass: 'text-green-500',
    bgClass: 'bg-green-500/10 border-green-500/30',
    description: 'Click to place marker',
  },
  MOVE: {
    label: 'MOVE',
    icon: Move,
    colorClass: 'text-orange-500',
    bgClass: 'bg-orange-500/10 border-orange-500/30',
    description: 'Click to move marker',
  },
}

export interface ModeIndicatorProps {
  /** Current viewer mode */
  mode: ViewerMode
  /** Optional product info when in PLACEMENT mode */
  placementProduct?: { fossPid: string; symbol?: string } | null
}

/**
 * ModeIndicator - Badge showing current viewer interaction mode
 */
export function ModeIndicator({ mode, placementProduct }: ModeIndicatorProps) {
  const config = MODE_CONFIG[mode]
  const Icon = config.icon

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
      <div
        className={cn(
          'px-3 py-1.5 rounded border shadow-sm backdrop-blur-sm',
          'flex items-center gap-2',
          config.bgClass
        )}
        title={config.description}
      >
        <Icon className={cn('h-4 w-4', config.colorClass)} />
        <span className={cn('text-xs font-semibold tracking-wide', config.colorClass)}>
          {config.label}
        </span>
        {mode === 'PLACEMENT' && placementProduct && (
          <>
            <div className="w-px h-4 bg-border/50" />
            <span className="text-xs font-mono text-foreground">
              {placementProduct.symbol || placementProduct.fossPid}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
