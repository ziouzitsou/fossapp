'use client'

/**
 * Loading and Error Overlays for the Planner Viewer
 *
 * Shows loading progress, error states, and WebGL compatibility issues
 * as overlays on top of the viewer container.
 */

import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Progress, Button } from '@fossapp/ui'

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
            DWG conversion can take 30-60 seconds.
            <br />
            <span className="text-amber-500">Please do not close this window.</span>
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

export interface WebGLErrorOverlayProps {
  /** URL to help page for graphics requirements */
  helpLink?: string
}

/**
 * WebGLErrorOverlay - Displayed when user's browser doesn't support WebGL
 *
 * Shows a professional "Browser Incompatible" message with guidance and a link
 * to graphics requirements documentation.
 */
export function WebGLErrorOverlay({ helpLink = '/support/graphics-requirements' }: WebGLErrorOverlayProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm z-10 p-6">
      <div className="max-w-md text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">Browser Not Compatible</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your browser doesn&apos;t support WebGL, which is required to display 3D/2D drawings.
          This is typically caused by:
        </p>
        <ul className="text-sm text-muted-foreground text-left mb-6 space-y-1">
          <li>&bull; Outdated browser version</li>
          <li>&bull; Disabled hardware acceleration</li>
          <li>&bull; Unsupported graphics drivers</li>
        </ul>
        <div className="flex flex-col gap-3">
          <Button asChild variant="default">
            <a href={helpLink}>
              View Graphics Requirements
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Try updating your browser or enabling hardware acceleration in browser settings.
          </p>
        </div>
      </div>
    </div>
  )
}
