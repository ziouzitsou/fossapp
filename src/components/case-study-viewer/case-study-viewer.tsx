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

import { useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo } from 'react'
import { cn } from '@fossapp/ui'
import type { Viewer3DInstance, Edit2DContext } from '@/types/autodesk-viewer'
import type { PlacementModeProduct, Placement, DwgUnitInfo, WorldCoordinates, ViewerMode } from './types'
import { PlacementTool } from './placement-tool'
import { Edit2DMarkers } from './edit2d-markers'
import { OriginIndicator } from './origin-indicator'
import { CaseStudyViewerToolbar } from './viewer-toolbar'
import { ViewerLoadingOverlay, ViewerErrorOverlay, WebGLErrorOverlay, CoordinateOverlay, ViewerQuickActions, ModeIndicator, LayerPanel, MeasurePanel, type LoadingStage, type TranslationWarning, type LayerInfo } from './overlays'
import { hexToRgb } from './case-study-viewer-utils'
import {
  useCoordinateTransform,
  useViewerApi,
  useMeasurement,
  useViewerEvents,
  useViewerInit,
  useCalibration,
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
  /** Hidden symbol groups - markers for these groups are removed from DOM */
  hiddenSymbolGroups?: Set<string>
  /** Callback when a placement is added via click-to-place (includes generated id) */
  onPlacementAdd?: (placement: Omit<Placement, 'dbId'>) => void
  /** Callback when a placement is deleted */
  onPlacementDelete?: (id: string) => void
  /** Callback when a placement is rotated (R key shortcut) */
  onPlacementRotate?: (id: string, rotation: number) => void
  /** Callback when a placement is moved (M key + click) */
  onPlacementMove?: (id: string, worldX: number, worldY: number) => void
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
  hiddenSymbolGroups,
  onPlacementAdd,
  onPlacementDelete,
  onPlacementRotate,
  onPlacementMove,
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
  const renderedPlacementIdsRef = useRef<Set<string>>(new Set())
  // Edit2D context for managed shape operations
  const edit2dContextRef = useRef<Edit2DContext | null>(null)
  // Edit2D markers manager
  const edit2dMarkersRef = useRef<Edit2DMarkers | null>(null)
  // Origin indicator (0,0 coordinate axes)
  const originIndicatorRef = useRef<OriginIndicator | null>(null)

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
  const [selectedMarkerFossPid, setSelectedMarkerFossPid] = useState<string | null>(null)
  const [dwgUnitString, setDwgUnitString] = useState<string | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const [dwgUnitInfo, setDwgUnitInfo] = useState<DwgUnitInfo | null>(null)
  const [translationWarnings, setTranslationWarnings] = useState<TranslationWarning[]>([])

  // Layer visibility state
  const [layers, setLayers] = useState<LayerInfo[]>([])
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({})

  // Track when calibration transform has been applied (fixes race condition)
  // This is set AFTER setTransform() is called, not when calibrationChecked becomes true
  const [calibrationTransformApplied, setCalibrationTransformApplied] = useState(false)

  // ═══════════════════════════════════════════════════════════════════════════
  // HOOKS
  // ═══════════════════════════════════════════════════════════════════════════

  // Coordinate transformation (Page ↔ DWG)
  const { pageToDwgCoords, dwgToPageCoords, setTransform } = useCoordinateTransform({
    viewerRef,
  })

  // Calibration detection
  const {
    calibrationChecked,
    isCalibrated,
    calibrationError,
    detectCalibration,
  } = useCalibration({ viewerRef })

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

  // Handler to exit measure mode (deactivate and reset state)
  const handleExitMeasureMode = useCallback(() => {
    const viewer = viewerRef.current
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const measureExt = viewer?.getExtension('Autodesk.Measure') as any
    if (measureExt) {
      measureExt.deactivate()
    }
    setMeasureMode('none')
  }, [setMeasureMode])

  const handleDeselectMarker = useCallback(() => {
    edit2dMarkersRef.current?.selectMarker(null)
  }, [])

  // Event handling (coordinates from events, selected entity for debugging)
  const { dwgCoordinates, setDwgCoordinates, selectedEntityInfo } = useViewerEvents({
    containerRef,
    viewerRef,
    isLoading,
    placementMode,
    isMeasuring: measureMode !== 'none',
    hasSelectedMarker,
    pageToDwgCoords,
    onViewerClick,
    onExitPlacementMode,
    onExitMeasureMode: handleExitMeasureMode,
    onDeselectMarker: handleDeselectMarker,
  })

  // Handler to capture DWG unit info for local state AND pass to external callback
  const handleUnitInfoAvailable = useCallback((info: DwgUnitInfo) => {
    setDwgUnitInfo(info)
    onUnitInfoAvailable?.(info)
  }, [onUnitInfoAvailable])

  // Viewer initialization
  const { handleFitAll } = useViewerInit({
    containerRef,
    viewerRef,
    placementToolRef,
    renderedPlacementIdsRef,
    edit2dContextRef,
    edit2dMarkersRef,
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
    setSelectedMarkerFossPid,
    setIsMoving,
    isCacheHit,
    getAccessToken,
    uploadFile,
    pollTranslationStatus,
    onReady,
    onError,
    onUnitInfoAvailable: handleUnitInfoAvailable,
    onPlacementAdd,
    onPlacementDelete,
    onPlacementRotate,
    onPlacementMove,
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // MANIFEST WARNINGS EFFECT
  // ═══════════════════════════════════════════════════════════════════════════

  // Fetch manifest warnings when loading completes
  useEffect(() => {
    if (!areaRevisionId || isLoading) return

    const fetchManifestWarnings = async () => {
      try {
        const response = await fetch(`/api/planner/manifest?areaRevisionId=${areaRevisionId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.warnings && data.warnings.length > 0) {
            setTranslationWarnings(data.warnings)
          }
        }
      } catch (err) {
        // Silently fail - warnings are non-critical
        console.warn('[CaseStudyViewer] Failed to fetch manifest warnings:', err)
      }
    }

    fetchManifestWarnings()
  }, [areaRevisionId, isLoading])

  // ═══════════════════════════════════════════════════════════════════════════
  // PLACEMENT MODE EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  // Activate/deactivate placement tool based on placementMode or isMoving
  // Move mode also needs snapping from the placement tool
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !placementToolRef.current) return

    if (placementMode || isMoving) {
      viewer.toolController.activateTool('placement-tool')

      // Exit measure mode when entering placement/move mode
      if (measureMode !== 'none') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const measureExt = viewer.getExtension('Autodesk.Measure') as any
        if (measureExt) {
          measureExt.deactivate()
        }
        setMeasureMode('none')
      }

      // Deselect any marker when entering placement mode (not move mode)
      if (placementMode) {
        edit2dMarkersRef.current?.selectMarker(null)
      }
    } else {
      viewer.toolController.deactivateTool('placement-tool')
    }
  }, [placementMode, isMoving, measureMode, setMeasureMode])

  // Effect to sync placements with Edit2D markers
  // Handles both adding new placements and removing deleted ones
  // IMPORTANT: Must wait for calibrationTransformApplied before rendering markers
  // Otherwise dwgToPageCoords returns incorrect coordinates for complex drawings
  useEffect(() => {
    if (!edit2dMarkersRef.current || isLoading || !calibrationTransformApplied) {
      return
    }

    // Build set of current placement IDs for quick lookup
    const currentPlacementIds = new Set(initialPlacements?.map((p) => p.id) ?? [])

    // REMOVAL: Find and remove markers for deleted placements
    for (const renderedId of renderedPlacementIdsRef.current) {
      if (!currentPlacementIds.has(renderedId)) {
        edit2dMarkersRef.current.deleteMarker(renderedId)
        renderedPlacementIdsRef.current.delete(renderedId)
      }
    }

    // ADDITION: Render any placements that haven't been rendered yet
    if (!initialPlacements?.length) return

    for (const placement of initialPlacements) {
      if (renderedPlacementIdsRef.current.has(placement.id)) continue

      // Convert DWG coords (from database) to page coords for marker positioning
      const pageCoords = dwgToPageCoords(placement.worldX, placement.worldY)
      edit2dMarkersRef.current.addMarker(
        pageCoords.x,
        pageCoords.y,
        {
          productId: placement.productId,
          projectProductId: placement.projectProductId,
          productName: placement.productName,
          fossPid: placement.fossPid,
          symbol: placement.symbol,
        },
        placement.id,
        placement.rotation
      )
      renderedPlacementIdsRef.current.add(placement.id)
    }
  }, [initialPlacements, isLoading, dwgToPageCoords, calibrationTransformApplied])

  // Effect to apply symbol group visibility
  // When hiddenSymbolGroups changes, show/hide markers accordingly
  useEffect(() => {
    if (isLoading) return
    if (!hiddenSymbolGroups) return

    edit2dMarkersRef.current?.applyHiddenGroups(hiddenSymbolGroups)
  }, [hiddenSymbolGroups, isLoading])

  // Effect to update background color when props change (e.g., user preferences load)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || isLoading) return

    const topRgb = hexToRgb(viewerBgTopColor)
    const bottomRgb = hexToRgb(viewerBgBottomColor)
    viewer.setBackgroundColor(
      topRgb.r, topRgb.g, topRgb.b,
      bottomRgb.r, bottomRgb.g, bottomRgb.b
    )
  }, [viewerBgTopColor, viewerBgBottomColor, isLoading])

  // Effect to update marker minimum size when props change
  useEffect(() => {
    if (isLoading || !edit2dMarkersRef.current) return

    edit2dMarkersRef.current.setMinScreenPx(markerMinScreenPx)
  }, [markerMinScreenPx, isLoading])

  // Effect to run calibration detection after viewer loads
  // Uses retry mechanism to handle instance tree population timing
  useEffect(() => {
    if (isLoading || !viewerRef.current?.model) return
    if (calibrationChecked) return // Already checked

    let attempts = 0
    const maxAttempts = 5
    const retryDelay = 500 // ms between retries

    const attemptCalibration = () => {
      attempts++
      detectCalibration().then((result) => {
        if (result.isCalibrated) {
          // Apply calibration to coordinate transform
          setTransform(result.scaleX, result.scaleY, result.offsetX, result.offsetY)
          console.log('[CaseStudyViewer] Calibration applied (attempt', attempts, '):', {
            scaleX: result.scaleX,
            scaleY: result.scaleY,
            offsetX: result.offsetX,
            offsetY: result.offsetY,
          })
          // Signal that transform is ready (AFTER setTransform, not when calibrationChecked is set)
          setCalibrationTransformApplied(true)
        } else if (attempts < maxAttempts) {
          // Retry - instance tree may not be fully populated yet
          console.log('[CaseStudyViewer] Calibration attempt', attempts, 'failed, retrying...')
          setTimeout(attemptCalibration, retryDelay)
        } else {
          console.warn('[CaseStudyViewer] Calibration failed after', attempts, 'attempts:', result.error)
          // Still signal completion so origin indicator can show (with default transform)
          setCalibrationTransformApplied(true)
        }
      })
    }

    // Start first attempt after initial delay
    const timeoutId = setTimeout(attemptCalibration, 300)

    return () => clearTimeout(timeoutId)
  }, [isLoading, calibrationChecked, detectCalibration, setTransform])

  // ═══════════════════════════════════════════════════════════════════════════
  // ORIGIN INDICATOR
  // ═══════════════════════════════════════════════════════════════════════════

  // Initialize and show origin indicator after calibration transform is applied
  // IMPORTANT: Must wait for calibrationTransformApplied (not calibrationChecked) to ensure
  // the coordinate transform is correct - fixes race condition where origin showed before
  // setTransform() was called
  useEffect(() => {
    if (isLoading || !edit2dContextRef.current || !dwgUnitInfo || !calibrationTransformApplied) return

    // Create origin indicator if not already created
    if (!originIndicatorRef.current) {
      originIndicatorRef.current = new OriginIndicator()
    }

    // Get model unit scale (e.g., 0.001 for mm, 1 for meters)
    const modelUnitScale = dwgUnitInfo.unitScale ?? 1

    // Initialize with Edit2D context and coordinate conversion
    originIndicatorRef.current.initialize(
      edit2dContextRef.current,
      dwgToPageCoords,
      modelUnitScale
    )

    // Show the origin indicator (125mm axes)
    originIndicatorRef.current.show({ sizeMm: 125 })

    // Cleanup on unmount
    return () => {
      originIndicatorRef.current?.dispose()
      originIndicatorRef.current = null
    }
  }, [isLoading, dwgToPageCoords, dwgUnitInfo, calibrationTransformApplied])

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER EXTRACTION & HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  // Extract layers from viewer model after loading
  useEffect(() => {
    const viewer = viewerRef.current
    if (isLoading || !viewer?.model) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const modelData = (viewer.model as any).getData?.()
      const layersRoot = modelData?.layersRoot

      if (layersRoot?.children) {
        const extractedLayers: LayerInfo[] = layersRoot.children
          .filter((layer: LayerInfo) => layer.isLayer)
          .map((layer: LayerInfo) => ({
            name: layer.name,
            id: layer.id,
            index: layer.index,
            isLayer: layer.isLayer,
          }))
          // Sort alphabetically by name
          .sort((a: LayerInfo, b: LayerInfo) => a.name.localeCompare(b.name))

        setLayers(extractedLayers)

        // Initialize all layers as visible
        const initialVisibility: Record<string, boolean> = {}
        for (const layer of extractedLayers) {
          initialVisibility[layer.name] = true
        }
        setLayerVisibility(initialVisibility)

        console.log('[CaseStudyViewer] Extracted', extractedLayers.length, 'layers from DWG')
      }
    } catch (err) {
      console.warn('[CaseStudyViewer] Failed to extract layers:', err)
    }
  }, [isLoading])

  // Toggle layer visibility
  const handleToggleLayer = useCallback((layer: LayerInfo) => {
    const viewer = viewerRef.current
    if (!viewer) return

    const currentlyVisible = layerVisibility[layer.name] ?? true
    const newVisible = !currentlyVisible

    // Update viewer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelData = (viewer.model as any).getData?.()
    const layerObj = modelData?.layersRoot?.children?.find(
      (l: LayerInfo) => l.name === layer.name
    )
    if (layerObj) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(viewer as any).setLayerVisible(layerObj, newVisible)
    }

    // Update state
    setLayerVisibility((prev) => ({
      ...prev,
      [layer.name]: newVisible,
    }))
  }, [layerVisibility])

  // Show all layers
  const handleShowAllLayers = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelData = (viewer.model as any).getData?.()
    const layersRoot = modelData?.layersRoot

    if (layersRoot?.children) {
      for (const layerObj of layersRoot.children) {
        if (layerObj.isLayer) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(viewer as any).setLayerVisible(layerObj, true)
        }
      }
    }

    // Update state - all visible
    const allVisible: Record<string, boolean> = {}
    for (const layer of layers) {
      allVisible[layer.name] = true
    }
    setLayerVisibility(allVisible)
  }, [layers])

  // Hide all layers
  const handleHideAllLayers = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelData = (viewer.model as any).getData?.()
    const layersRoot = modelData?.layersRoot

    if (layersRoot?.children) {
      for (const layerObj of layersRoot.children) {
        if (layerObj.isLayer) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(viewer as any).setLayerVisible(layerObj, false)
        }
      }
    }

    // Update state - all hidden
    const allHidden: Record<string, boolean> = {}
    for (const layer of layers) {
      allHidden[layer.name] = false
    }
    setLayerVisibility(allHidden)
  }, [layers])

  // ═══════════════════════════════════════════════════════════════════════════
  // TOOLBAR HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleDeleteSelectedMarker = useCallback(() => {
    edit2dMarkersRef.current?.deleteSelected()
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // DERIVED STATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Derive viewer mode from existing state (similar to AutoCAD command modes)
   * Priority: PLACEMENT > MEASUREMENT > SELECT > IDLE
   */
  const viewerMode: ViewerMode = useMemo(() => {
    if (isMoving) return 'MOVE'
    if (placementMode) return 'PLACEMENT'
    if (measureMode !== 'none') return 'MEASUREMENT'
    if (hasSelectedMarker) return 'SELECT'
    return 'IDLE'
  }, [isMoving, placementMode, measureMode, hasSelectedMarker])

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

        {/* Error overlay - show WebGL-specific overlay for browser incompatibility */}
        {error && (
          error === 'WEBGL_NOT_SUPPORTED'
            ? <WebGLErrorOverlay />
            : <ViewerErrorOverlay error={error} />
        )}

        {/* Coordinate display overlay - top left corner */}
        {showToolbar && (
          <CoordinateOverlay
            coordinates={dwgCoordinates}
            unitString={dwgUnitString}
            dwgUnitInfo={dwgUnitInfo}
            calibrationChecked={calibrationChecked}
            isCalibrated={isCalibrated}
            translationWarnings={translationWarnings}
            onDismissWarnings={() => setTranslationWarnings([])}
          />
        )}

        {/* Mode indicator - top center */}
        {showToolbar && (
          <ModeIndicator
            mode={viewerMode}
            placementProduct={placementMode}
          />
        )}

        {/* Selected entity badge - bottom center (for debugging) */}
        {selectedEntityInfo && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="bg-black/80 text-white text-xs px-3 py-1.5 rounded-full font-mono shadow-lg border border-white/20">
              <span className="text-yellow-400">[{selectedEntityInfo.dbId}]</span>
              {' '}{selectedEntityInfo.name}
              {selectedEntityInfo.layer && (
                <span className="text-blue-300 ml-2">@ {selectedEntityInfo.layer}</span>
              )}
            </div>
          </div>
        )}

        {/* Quick actions - top right corner */}
        {showToolbar && (
          <ViewerQuickActions onFitAll={handleFitAll} />
        )}

        {/* Measure panel - bottom left corner, above layers */}
        {showToolbar && (
          <MeasurePanel
            measureMode={measureMode}
            hasMeasurement={hasMeasurement}
            onToggleMeasure={handleToggleMeasure}
            onClearMeasurements={handleClearMeasurements}
          />
        )}

        {/* Layer panel - bottom left corner */}
        {showToolbar && layers.length > 0 && (
          <LayerPanel
            layers={layers}
            layerVisibility={layerVisibility}
            onToggleLayer={handleToggleLayer}
            onShowAll={handleShowAllLayers}
            onHideAll={handleHideAllLayers}
          />
        )}
      </div>

      {/* Custom Toolbar - OUTSIDE the canvas */}
      {showToolbar && (
        <CaseStudyViewerToolbar
          measureMode={measureMode}
          hasMeasurement={hasMeasurement}
          onToggleMeasure={handleToggleMeasure}
          onClearMeasurements={handleClearMeasurements}
        />
      )}
    </div>
  )
}
