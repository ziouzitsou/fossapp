'use client'

/**
 * CaseStudyViewerToolbar - Custom toolbar for the case study viewer
 *
 * Provides measurement tools and placement controls outside the WebGL canvas.
 * This allows full control over styling and interaction.
 */

import { Ruler, Eraser, Square } from 'lucide-react'
import { Button } from '@fossapp/ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@fossapp/ui'

export type MeasureMode = 'none' | 'distance' | 'area'

export interface ViewerToolbarProps {
  /** Current measurement mode */
  measureMode: MeasureMode
  /** Whether there's an active measurement */
  hasMeasurement: boolean
  /** Callback to toggle measurement mode */
  onToggleMeasure: (mode: 'distance' | 'area') => void
  /** Callback to clear measurements */
  onClearMeasurements: () => void
}

export function CaseStudyViewerToolbar({
  measureMode,
  hasMeasurement,
  onToggleMeasure,
  onClearMeasurements,
}: ViewerToolbarProps) {
  return (
    <div className="flex-none border-t bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="flex items-center justify-center gap-1 p-2">
        {/* Toolbar currently empty - will be populated with future tools */}

        {/* TODO: Measure tools temporarily disabled - need event-based state sync instead of polling */}
        {false && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={measureMode === 'distance' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onToggleMeasure('distance')}
                >
                  <Ruler className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Measure Distance</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={measureMode === 'area' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onToggleMeasure('area')}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Measure Area</TooltipContent>
            </Tooltip>

            {hasMeasurement && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearMeasurements}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Eraser className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear Measurement</TooltipContent>
              </Tooltip>
            )}
          </>
        )}

        {/* Delete button removed - use Delete key instead */}
      </div>
    </div>
  )
}
