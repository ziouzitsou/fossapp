'use client'

/**
 * PlannerViewerToolbar - Custom toolbar for the planner viewer
 *
 * Provides measurement tools and placement controls outside the WebGL canvas.
 * This allows full control over styling and interaction.
 */

import { Ruler, Trash2, Square, MousePointer2 } from 'lucide-react'
import { Button } from '@fossapp/ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@fossapp/ui'
import type { PlacementModeProduct } from './types'

export type MeasureMode = 'none' | 'distance' | 'area'

export interface ViewerToolbarProps {
  /** Current measurement mode */
  measureMode: MeasureMode
  /** Whether there's an active measurement */
  hasMeasurement: boolean
  /** Whether a marker is selected */
  hasSelectedMarker: boolean
  /** Product being placed (click-to-place mode) */
  placementMode?: PlacementModeProduct | null
  /** Callback to toggle measurement mode */
  onToggleMeasure: (mode: 'distance' | 'area') => void
  /** Callback to clear measurements */
  onClearMeasurements: () => void
  /** Callback to delete selected marker */
  onDeleteSelectedMarker: () => void
  /** Callback to exit placement mode */
  onExitPlacementMode?: () => void
}

export function PlannerViewerToolbar({
  measureMode,
  hasMeasurement,
  hasSelectedMarker,
  placementMode,
  onToggleMeasure,
  onClearMeasurements,
  onDeleteSelectedMarker,
  onExitPlacementMode,
}: ViewerToolbarProps) {
  return (
    <div className="flex-none border-t bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="flex items-center justify-center gap-1 p-2">
        {/* Placement mode indicator - styled like active measure button */}
        {placementMode && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onExitPlacementMode?.()}
                >
                  <MousePointer2 className="h-4 w-4" />
                  <span className="text-xs font-medium">
                    {placementMode.fossPid}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Click to exit placement mode (or press ESC)</TooltipContent>
            </Tooltip>
            <div className="w-px h-6 bg-border mx-1" />
          </>
        )}

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
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear Measurement</TooltipContent>
          </Tooltip>
        )}

        {hasSelectedMarker && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDeleteSelectedMarker}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete Marker (or press Delete key)</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
