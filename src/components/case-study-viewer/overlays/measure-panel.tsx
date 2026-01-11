'use client'

/**
 * MeasurePanel - Measurement tool buttons positioned above layers panel
 *
 * Provides quick access to distance and area measurement tools.
 * Stacked vertically with distance on top, area below.
 * Uses the APS Viewer's built-in Autodesk.Measure extension.
 */

import { Ruler, Square, Eraser } from 'lucide-react'
import { cn, Button, Tooltip, TooltipContent, TooltipTrigger } from '@fossapp/ui'

/** Measurement mode type */
export type MeasureMode = 'none' | 'distance' | 'area'

export interface MeasurePanelProps {
  /** Current measurement mode */
  measureMode: MeasureMode
  /** Whether there's an active measurement that can be cleared */
  hasMeasurement: boolean
  /** Callback to toggle measurement mode */
  onToggleMeasure: (mode: 'distance' | 'area') => void
  /** Callback to clear all measurements */
  onClearMeasurements: () => void
}

/**
 * MeasurePanel - Measurement tool buttons
 */
export function MeasurePanel({
  measureMode,
  hasMeasurement,
  onToggleMeasure,
  onClearMeasurements,
}: MeasurePanelProps) {
  return (
    <div className="absolute bottom-14 left-3 z-20 flex flex-col gap-1">
      {/* Distance measurement button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-8 w-8 bg-background/85 backdrop-blur-sm shadow-sm',
              measureMode === 'distance'
                ? 'border-amber-500 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                : 'border-border/50 hover:bg-accent'
            )}
            onClick={() => onToggleMeasure('distance')}
          >
            <Ruler className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p>Measure Distance</p>
          <p className="text-xs text-muted-foreground">Click two points</p>
        </TooltipContent>
      </Tooltip>

      {/* Area measurement button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-8 w-8 bg-background/85 backdrop-blur-sm shadow-sm',
              measureMode === 'area'
                ? 'border-amber-500 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                : 'border-border/50 hover:bg-accent'
            )}
            onClick={() => onToggleMeasure('area')}
          >
            <Square className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p>Measure Area</p>
          <p className="text-xs text-muted-foreground">Click polygon points, double-click to close</p>
        </TooltipContent>
      </Tooltip>

      {/* Clear measurements button - only show when there are measurements */}
      {hasMeasurement && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/85 backdrop-blur-sm border-border/50 shadow-sm text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onClearMeasurements}
            >
              <Eraser className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Clear Measurements
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
