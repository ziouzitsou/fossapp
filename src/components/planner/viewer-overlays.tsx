'use client'

/**
 * ViewerOverlays - Loading, error, and coordinate overlays for the planner viewer
 *
 * Shows loading progress, error states, and real-time DWG coordinates
 * as overlays on top of the viewer container.
 */

import { Loader2, AlertCircle, CheckCircle2, Crosshair } from 'lucide-react'
import { Progress, cn } from '@fossapp/ui'
import type { DwgCoordinates } from './placement-tool'

export type LoadingStage = 'scripts' | 'upload' | 'translation' | 'viewer' | 'cache-hit'

export interface ViewerOverlaysProps {
  /** Whether the viewer is loading */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Current loading stage */
  loadingStage: LoadingStage
  /** Translation progress (0-100) */
  translationProgress: number
  /** Whether progress is indeterminate */
  isIndeterminate: boolean
  /** Whether this is a cache hit (instant load) */
  isCacheHit: boolean
  /** Whether using persistent storage (project-based) */
  projectId?: string
}

function getLoadingMessage(
  loadingStage: LoadingStage,
  projectId?: string,
  isIndeterminate?: boolean,
  translationProgress?: number
): string {
  switch (loadingStage) {
    case 'scripts':
      return 'Loading viewer...'
    case 'upload':
      return projectId ? 'Uploading to persistent storage...' : 'Uploading floor plan...'
    case 'cache-hit':
      return 'Using cached translation...'
    case 'translation':
      // Show percentage only if APS provides real progress, otherwise just "Converting..."
      return isIndeterminate
        ? 'Converting DWG...'
        : `Converting DWG (${translationProgress}%)...`
    case 'viewer':
      return 'Initializing viewer...'
    default:
      return 'Loading...'
  }
}

export function ViewerLoadingOverlay({
  loadingStage,
  translationProgress,
  isIndeterminate,
  projectId,
}: Pick<ViewerOverlaysProps, 'loadingStage' | 'translationProgress' | 'isIndeterminate' | 'projectId'>) {
  const message = getLoadingMessage(loadingStage, projectId, isIndeterminate, translationProgress)

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs z-10">
      {loadingStage === 'cache-hit' ? (
        <CheckCircle2 className="h-8 w-8 text-green-500 mb-4" />
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      )}
      <p className="text-sm text-muted-foreground mb-2">{message}</p>
      {loadingStage === 'cache-hit' && (
        <p className="text-xs text-green-600">
          Same file detected - no re-translation needed!
        </p>
      )}
      {loadingStage === 'translation' && (
        <div className="w-48">
          {isIndeterminate ? (
            /* Indeterminate progress bar - sliding animation */
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden relative">
              <div className="absolute h-full w-1/3 bg-primary rounded-full animate-slide" />
            </div>
          ) : (
            <Progress value={translationProgress} className="h-2" />
          )}
          <p className="text-xs text-muted-foreground text-center mt-1">
            DWG conversion can take 30-60 seconds
          </p>
        </div>
      )}
    </div>
  )
}

export function ViewerErrorOverlay({ error }: { error: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs z-10">
      <AlertCircle className="h-8 w-8 text-destructive mb-4" />
      <p className="text-sm text-destructive text-center max-w-md px-4">{error}</p>
    </div>
  )
}

export interface CoordinateOverlayProps {
  /** Current DWG coordinates (null when mouse outside viewer) */
  coordinates: DwgCoordinates | null
  /** DWG unit string (e.g., "mm", "m", "inch") */
  unitString?: string | null
}

/**
 * CoordinateOverlay - Displays real-time DWG coordinates in viewer top-left
 *
 * Similar to AutoCAD's status bar coordinate display.
 * Shows X/Y in DWG model space units with snap indicator.
 */
export function CoordinateOverlay({ coordinates, unitString }: CoordinateOverlayProps) {
  if (!coordinates) {
    return (
      <div className="absolute top-3 left-3 z-20 px-2.5 py-1.5 bg-background/85 backdrop-blur-sm rounded border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Crosshair className="h-3.5 w-3.5" />
          <span>X: ---</span>
          <span>Y: ---</span>
        </div>
      </div>
    )
  }

  // Format coordinates with 2 decimal places
  const xDisplay = coordinates.x.toFixed(2)
  const yDisplay = coordinates.y.toFixed(2)

  return (
    <div
      className={cn(
        'absolute top-3 left-3 z-20 px-2.5 py-1.5 rounded border shadow-sm transition-colors',
        'bg-background/85 backdrop-blur-sm',
        coordinates.isSnapped
          ? 'border-primary/50 bg-primary/10'
          : 'border-border/50'
      )}
    >
      <div className="flex items-center gap-2 text-xs font-mono">
        <Crosshair
          className={cn(
            'h-3.5 w-3.5 transition-colors',
            coordinates.isSnapped ? 'text-primary' : 'text-muted-foreground'
          )}
        />
        <span className={cn(coordinates.isSnapped && 'text-primary')}>
          X: {xDisplay}
        </span>
        <span className={cn(coordinates.isSnapped && 'text-primary')}>
          Y: {yDisplay}
        </span>
        {unitString && (
          <span className="text-muted-foreground">{unitString}</span>
        )}
        {coordinates.isSnapped && coordinates.snapType && (
          <span className="text-primary text-[10px] uppercase tracking-wide">
            [{coordinates.snapType}]
          </span>
        )}
      </div>
    </div>
  )
}
