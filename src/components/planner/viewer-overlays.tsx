'use client'

/**
 * ViewerOverlays - Loading and error overlays for the planner viewer
 *
 * Shows loading progress and error states as overlays on top of the viewer container.
 */

import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Progress } from '@fossapp/ui'

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
