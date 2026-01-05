'use client'

/**
 * ViewerOverlays - Loading, error, and coordinate overlays for the planner viewer
 *
 * Shows loading progress, error states, and real-time DWG coordinates
 * as overlays on top of the viewer container.
 */

import { Loader2, AlertCircle, CheckCircle2, Crosshair, Maximize, Info, Keyboard } from 'lucide-react'
import { Progress, cn, Button } from '@fossapp/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@fossapp/ui'
import type { DwgCoordinates } from './placement-tool'
import type { DwgUnitInfo } from './types'

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

export interface CoordinateOverlayProps {
  /** Current DWG coordinates (null when mouse outside viewer) */
  coordinates: DwgCoordinates | null
  /** DWG unit string (e.g., "mm", "m", "inch") */
  unitString?: string | null
  /** Full DWG unit info for info popover */
  dwgUnitInfo?: DwgUnitInfo | null
}

/**
 * Keyboard shortcuts for the viewer
 * Only includes verified working shortcuts
 */
const KEYBOARD_SHORTCUTS = {
  placement: [
    { key: 'R', description: 'Rotate selected marker 15°' },
    { key: 'Del / ⌫', description: 'Delete selected marker' },
    { key: 'Esc', description: 'Exit placement mode' },
  ],
  navigation: [
    { key: '↑ ↓', description: 'Zoom in/out' },
    { key: '← →', description: 'Pan left/right' },
    { key: 'PgUp / PgDn', description: 'Pan up/down' },
    { key: 'Scroll', description: 'Zoom in/out' },
    { key: 'Drag', description: 'Pan the view' },
  ],
}

/**
 * DwgInfoPopover - Info button with DWG details and keyboard shortcuts
 */
function DwgInfoPopover({ dwgUnitInfo }: { dwgUnitInfo?: DwgUnitInfo | null }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="p-1 rounded hover:bg-muted/50 transition-colors"
          title="Drawing info & shortcuts"
        >
          <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start" sideOffset={8}>
        <div className="space-y-4">
          {/* DWG Unit Information */}
          <div>
            <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
              <Info className="h-4 w-4" />
              DWG Information
            </h4>
            {dwgUnitInfo ? (
              <div className="space-y-1.5 text-sm">
                {dwgUnitInfo.modelUnits && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model Units:</span>
                    <span className="font-mono">{dwgUnitInfo.modelUnits}</span>
                  </div>
                )}
                {dwgUnitInfo.unitString && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit String:</span>
                    <span className="font-mono">{dwgUnitInfo.unitString}</span>
                  </div>
                )}
                {dwgUnitInfo.displayUnit && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Display Unit:</span>
                    <span className="font-mono">{dwgUnitInfo.displayUnit}</span>
                  </div>
                )}
                {dwgUnitInfo.unitScale !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Scale to Meters:</span>
                    <span className="font-mono">{dwgUnitInfo.unitScale}</span>
                  </div>
                )}
                {dwgUnitInfo.pageUnits && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Page Units:</span>
                    <span className="font-mono">{dwgUnitInfo.pageUnits}</span>
                  </div>
                )}
                {!dwgUnitInfo.unitString && !dwgUnitInfo.displayUnit &&
                 !dwgUnitInfo.modelUnits && !dwgUnitInfo.pageUnits && (
                  <p className="text-muted-foreground italic text-xs">
                    No unit information available
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground italic text-xs">
                No DWG loaded
              </p>
            )}
          </div>

          {/* Separator */}
          <div className="border-t" />

          {/* Keyboard Shortcuts */}
          <div>
            <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
              <Keyboard className="h-4 w-4" />
              Keyboard Shortcuts
            </h4>
            <div className="space-y-3 text-sm">
              {/* Placement shortcuts */}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                  Placement
                </div>
                <div className="space-y-1">
                  {KEYBOARD_SHORTCUTS.placement.map((shortcut) => (
                    <div key={shortcut.key} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{shortcut.description}</span>
                      <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
              {/* Navigation shortcuts */}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                  Navigation
                </div>
                <div className="space-y-1">
                  {KEYBOARD_SHORTCUTS.navigation.map((shortcut) => (
                    <div key={shortcut.key} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{shortcut.description}</span>
                      <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * CoordinateOverlay - Displays real-time DWG coordinates in viewer top-left
 *
 * Similar to AutoCAD's status bar coordinate display.
 * Shows X/Y in DWG model space units with snap indicator.
 * Includes info button for DWG details and keyboard shortcuts.
 */
export function CoordinateOverlay({ coordinates, unitString, dwgUnitInfo }: CoordinateOverlayProps) {
  if (!coordinates) {
    return (
      <div className="absolute top-3 left-3 z-20 px-2.5 py-1.5 bg-background/85 backdrop-blur-sm rounded border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <DwgInfoPopover dwgUnitInfo={dwgUnitInfo} />
          <div className="w-px h-4 bg-border/50" />
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
        <DwgInfoPopover dwgUnitInfo={dwgUnitInfo} />
        <div className="w-px h-4 bg-border/50" />
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

export interface ViewerQuickActionsProps {
  /** Callback to fit all geometry in view */
  onFitAll: () => void
}

/**
 * ViewerQuickActions - Quick action buttons in viewer top-right
 *
 * Provides one-click access to common viewer operations like Fit All.
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

