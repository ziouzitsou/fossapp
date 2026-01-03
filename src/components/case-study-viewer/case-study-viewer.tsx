'use client'

/**
 * CaseStudyViewer - Dedicated APS Viewer for the Case Study feature
 *
 * Uses Viewer3D (no built-in GUI) with custom external toolbar controls.
 * This allows full control over the UI layout and styling.
 *
 * Features:
 * - Custom toolbar outside the WebGL canvas
 * - Click-to-place products
 * - Coordinate conversion (screen to world)
 * - Clean integration with our React UI
 * - PERSISTENT storage with SHA256 caching (same file = instant load)
 *
 * Architecture:
 * The component is organized using custom hooks for separation of concerns:
 * - useCoordinateTransform: Page ↔ DWG coordinate conversion
 * - useViewerApi: Authentication, upload, translation polling
 * - useMeasurement: Measurement tool state and handlers
 * - useViewerEvents: DOM events and keyboard handlers
 * - useViewerInit: Complete viewer initialization lifecycle
 */

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { cn } from '@fossapp/ui'
import type { Viewer3DInstance } from '@/types/autodesk-viewer'
import type { PlacementModeProduct, Placement, DwgUnitInfo, WorldCoordinates } from './types'
import { PlacementTool } from './placement-tool'
import { MarkupMarkers } from './markup-markers'
import { CaseStudyViewerToolbar } from './viewer-toolbar'
import { ViewerLoadingOverlay, ViewerErrorOverlay, CoordinateOverlay, ViewerQuickActions, type LoadingStage } from './viewer-overlays'
import {
  useCoordinateTransform,
  useViewerApi,
  useMeasurement,
  useViewerEvents,
  useViewerInit,
} from './hooks'

// Re-export types for consumers
export type { Viewer3DInstance }
export type { WorldCoordinates }

// Navigation tool modes (re-export from types)
export type { ViewerTool } from './types'

export interface CaseStudyViewerProps {
  /** File to upload and view */
  file?: File
  /** URN of already uploaded file */
  urn?: string
  /** Project ID for persistent storage and caching (uses planner API) */
  projectId?: string
  /** Area revision ID for floor plan storage (required for upload) */
  areaRevisionId?: string
  /** Initial theme */
  theme?: 'light' | 'dark'
  /** Product being placed (click-to-place mode) */
  placementMode?: PlacementModeProduct | null
  /** Initial placements to render when viewer loads (from database) */
  initialPlacements?: Placement[]
  /** Minimum screen size for markers in pixels (from user preferences) */
  markerMinScreenPx?: number
  /** Background gradient top color (hex, from user preferences) */
  viewerBgTopColor?: string
  /** Background gradient bottom color (hex, from user preferences) */
  viewerBgBottomColor?: string
  /** Reverse mouse wheel zoom direction (from user preferences) */
  reverseZoomDirection?: boolean
  /** Callback when a placement is added via click-to-place (includes generated id) */
  onPlacementAdd?: (placement: Omit<Placement, 'dbId'>) => void
  /** Callback when a placement is deleted */
  onPlacementDelete?: (id: string) => void
  /** Callback when a placement is rotated (R key shortcut) */
  onPlacementRotate?: (id: string, rotation: number) => void
  /** Callback to exit placement mode */
  onExitPlacementMode?: () => void
  /** Callback when viewer is ready */
  onReady?: (viewer: Viewer3DInstance) => void
  /** Callback when error occurs */
  onError?: (error: string) => void
  /** Callback when user clicks on the viewer (for placing products) */
  onViewerClick?: (worldCoords: WorldCoordinates | null, screenCoords: { x: number; y: number }) => void
  /** Callback when upload completes (with cache info) */
  onUploadComplete?: (urn: string, isNewUpload: boolean, fileName: string) => void
  /** Callback when translation completes successfully */
  onTranslationComplete?: (urn: string) => void
  /** Callback when DWG unit info is available (after model loads) */
  onUnitInfoAvailable?: (info: DwgUnitInfo) => void
  /** Additional class name */
  className?: string
}

/**
 * APS-powered viewer for case study floor plans with product placement.
 *
 * @remarks
 * Uses Viewer3D (no built-in GUI) with custom external controls.
 * State is managed via five specialized hooks for separation of concerns.
 *
 * **Key capabilities**:
 * - Upload DWG files with SHA256-based caching (instant reload for same files)
 * - Click-to-place products with world coordinate conversion
 * - Measurement tools (distance and area)
 * - Custom marker rendering for placed products
 */
export function CaseStudyViewer({
  file,
  urn: initialUrn,
  projectId,
  areaRevisionId,
  theme: initialTheme = 'dark',
  placementMode,
  initialPlacements,
  markerMinScreenPx = 12,
  viewerBgTopColor = '#2a2a2a',
  viewerBgBottomColor = '#0a0a0a',
  reverseZoomDirection = false,
  onPlacementAdd,
  onPlacementDelete,
  onPlacementRotate,
  onExitPlacementMode,
  onReady,
  onError,
  onViewerClick,
  onUploadComplete,
  onTranslationComplete,
  onUnitInfoAvailable,
  className,
}: CaseStudyViewerProps) {
  // ═══════════════════════════════════════════════════════════════════════════
  // REFS
  // ═══════════════════════════════════════════════════════════════════════════
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer3DInstance | null>(null)
  const placementToolRef = useRef<PlacementTool | null>(null)
  const markupMarkersRef = useRef<MarkupMarkers | null>(null)
  const renderedPlacementIdsRef = useRef<Set<string>>(new Set())

  // Ref for placementMode so hooks can access latest value without re-registering
  const placementModeRef = useRef(placementMode)
  useLayoutEffect(() => {
    placementModeRef.current = placementMode
  }, [placementMode])

  // Ref for initial placements to render after viewer is ready
  const initialPlacementsRef = useRef(initialPlacements)
  useLayoutEffect(() => {
    initialPlacementsRef.current = initialPlacements
  }, [initialPlacements])

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('scripts')
  const [translationProgress, setTranslationProgress] = useState(0)
  const [isIndeterminate, setIsIndeterminate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urn, setUrn] = useState<string | undefined>(initialUrn)
  const [isCacheHit, setIsCacheHit] = useState(false)
  const [hasSelectedMarker, setHasSelectedMarker] = useState(false)
  const [dwgUnitString, setDwgUnitString] = useState<string | null>(null)

  // ═══════════════════════════════════════════════════════════════════════════
  // HOOKS
  // ═══════════════════════════════════════════════════════════════════════════

  // Coordinate transformation (Page ↔ DWG)
  const { pageToDwgCoords, dwgToPageCoords, setTransform } = useCoordinateTransform({
    viewerRef,
  })

  // API calls (auth, upload, translation)
  const { getAccessToken, uploadFile, pollTranslationStatus } = useViewerApi({
    file,
    projectId,
    areaRevisionId,
    setLoadingStage,
    setIsCacheHit,
    setTranslationProgress,
    setIsIndeterminate,
    onUploadComplete,
    onTranslationComplete,
  })

  // Measurement tools
  const {
    measureMode,
    hasMeasurement,
    handleToggleMeasure,
    handleClearMeasurements,
    setMeasureMode,
  } = useMeasurement({
    viewerRef,
    placementMode,
    onExitPlacementMode,
  })

  // Event handling (coordinates from events)
  const { dwgCoordinates, setDwgCoordinates } = useViewerEvents({
    containerRef,
    viewerRef,
    isLoading,
    placementMode,
    pageToDwgCoords,
    onViewerClick,
    onExitPlacementMode,
  })

  // Viewer initialization
  const { handleFitAll } = useViewerInit({
    containerRef,
    viewerRef,
    placementToolRef,
    markupMarkersRef,
    renderedPlacementIdsRef,
    file,
    urn,
    setUrn,
    initialTheme,
    markerMinScreenPx,
    viewerBgTopColor,
    viewerBgBottomColor,
    reverseZoomDirection,
    placementModeRef,
    initialPlacementsRef,
    pageToDwgCoords,
    dwgToPageCoords,
    setTransform,
    setIsLoading,
    setLoadingStage,
    setError,
    setDwgUnitString,
    setDwgCoordinates,
    setHasSelectedMarker,
    isCacheHit,
    getAccessToken,
    uploadFile,
    pollTranslationStatus,
    onReady,
    onError,
    onUnitInfoAvailable,
    onPlacementAdd,
    onPlacementDelete,
    onPlacementRotate,
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PLACEMENT MODE EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  // Activate/deactivate placement tool based on placementMode
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !placementToolRef.current) return

    if (placementMode) {
      viewer.toolController.activateTool('placement-tool')

      // Exit measure mode when entering placement mode
      if (measureMode !== 'none') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const measureExt = viewer.getExtension('Autodesk.Measure') as any
        if (measureExt) {
          measureExt.deactivate()
        }
        setMeasureMode('none')
      }
    } else {
      viewer.toolController.deactivateTool('placement-tool')
    }
  }, [placementMode, measureMode, setMeasureMode])

  // Effect to render late-arriving placements (handles race condition)
  // This runs when initialPlacements changes after viewer is ready
  useEffect(() => {
    if (!initialPlacements?.length || !markupMarkersRef.current || isLoading) {
      return
    }

    // Render any placements that haven't been rendered yet
    // Placements store DWG coords, convert to page coords for marker positioning
    let newlyRendered = 0
    for (const placement of initialPlacements) {
      if (renderedPlacementIdsRef.current.has(placement.id)) continue

      // Convert DWG coords (from database) to page coords for marker positioning
      const pageCoords = dwgToPageCoords(placement.worldX, placement.worldY)
      markupMarkersRef.current.addMarkerAtWorld(
        pageCoords.x,
        pageCoords.y,
        0,
        {
          productId: placement.productId,
          projectProductId: placement.projectProductId,
          productName: placement.productName,
          symbol: placement.symbol,  // Symbol label from database
        },
        placement.id,
        placement.rotation  // Initial rotation from database
      )
      renderedPlacementIdsRef.current.add(placement.id)
      newlyRendered++
    }

    if (newlyRendered > 0) {
      console.log('[CaseStudyViewer] Rendered', newlyRendered, 'late-arriving placements')
    }
  }, [initialPlacements, isLoading, dwgToPageCoords])

  // ═══════════════════════════════════════════════════════════════════════════
  // TOOLBAR HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleDeleteSelectedMarker = useCallback(() => {
    markupMarkersRef.current?.deleteSelected()
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const showToolbar = !isLoading && !error

  return (
    <div className={cn('relative w-full h-full flex flex-col', className)}>
      {/* Viewer container - takes remaining space */}
      <div className="flex-1 relative">
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{
            background: initialTheme === 'dark' ? '#1a1a1a' : '#f0f0f0',
          }}
        />

        {/* Loading overlay */}
        {isLoading && !error && (
          <ViewerLoadingOverlay
            loadingStage={loadingStage}
            translationProgress={translationProgress}
            isIndeterminate={isIndeterminate}
            projectId={projectId}
          />
        )}

        {/* Error overlay */}
        {error && <ViewerErrorOverlay error={error} />}

        {/* Coordinate display overlay - top left corner */}
        {showToolbar && (
          <CoordinateOverlay
            coordinates={dwgCoordinates}
            unitString={dwgUnitString}
          />
        )}

        {/* Quick actions - top right corner */}
        {showToolbar && (
          <ViewerQuickActions onFitAll={handleFitAll} />
        )}
      </div>

      {/* Custom Toolbar - OUTSIDE the canvas */}
      {showToolbar && (
        <CaseStudyViewerToolbar
          measureMode={measureMode}
          hasMeasurement={hasMeasurement}
          hasSelectedMarker={hasSelectedMarker}
          placementMode={placementMode}
          onToggleMeasure={handleToggleMeasure}
          onClearMeasurements={handleClearMeasurements}
          onDeleteSelectedMarker={handleDeleteSelectedMarker}
          onExitPlacementMode={onExitPlacementMode}
        />
      )}
    </div>
  )
}
