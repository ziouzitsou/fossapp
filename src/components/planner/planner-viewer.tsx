'use client'

/**
 * PlannerViewer - Dedicated APS Viewer for the Planner feature
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
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@fossapp/ui'
import type { Viewer3DInstance, WorldCoordinates as WorldCoordsType, ViewerInitOptions } from '@/types/autodesk-viewer'
import type { PlacementModeProduct, Placement, DwgUnitInfo } from './types'
import { PlacementTool, type DwgCoordinates } from './placement-tool'
import { MarkupMarkers } from './markup-markers'
import { PlannerViewerToolbar, type MeasureMode } from './viewer-toolbar'
import { ViewerLoadingOverlay, ViewerErrorOverlay, CoordinateOverlay, ViewerQuickActions, type LoadingStage } from './viewer-overlays'
import { hexToRgb, loadAutodeskScripts } from './planner-viewer-utils'

// Re-export the Viewer3DInstance type for consumers
export type { Viewer3DInstance }

// Status polling types
interface TranslationStatus {
  status: 'pending' | 'inprogress' | 'success' | 'failed'
  progress: string
  messages?: string[]
}

// World coordinates for planner placements (re-export from shared types)
export type WorldCoordinates = WorldCoordsType

// Navigation tool modes
export type ViewerTool = 'pan' | 'orbit' | 'zoom' | 'select'

export interface PlannerViewerProps {
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

export function PlannerViewer({
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
  onExitPlacementMode,
  onReady,
  onError,
  onViewerClick,
  onUploadComplete,
  onTranslationComplete,
  onUnitInfoAvailable,
  className,
}: PlannerViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer3DInstance | null>(null)

  // Use refs for callbacks to prevent re-initialization when parent re-renders
  const onReadyRef = useRef(onReady)
  const onErrorRef = useRef(onError)
  const onUploadCompleteRef = useRef(onUploadComplete)
  const onTranslationCompleteRef = useRef(onTranslationComplete)
  const onUnitInfoAvailableRef = useRef(onUnitInfoAvailable)
  const onPlacementAddRef = useRef(onPlacementAdd)
  const onPlacementDeleteRef = useRef(onPlacementDelete)
  onReadyRef.current = onReady
  onErrorRef.current = onError
  onUploadCompleteRef.current = onUploadComplete
  onTranslationCompleteRef.current = onTranslationComplete
  onUnitInfoAvailableRef.current = onUnitInfoAvailable
  onPlacementAddRef.current = onPlacementAdd
  onPlacementDeleteRef.current = onPlacementDelete

  // Track if viewer has been initialized to prevent double init
  const isInitializedRef = useRef(false)

  // Ref for placementMode so the tool can access latest value without re-registering
  const placementModeRef = useRef(placementMode)
  placementModeRef.current = placementMode

  // Ref for the placement tool instance
  const placementToolRef = useRef<PlacementTool | null>(null)

  // Ref for MarkupMarkers instance
  const markupMarkersRef = useRef<MarkupMarkers | null>(null)

  // Ref for initial placements to render after viewer is ready
  const initialPlacementsRef = useRef(initialPlacements)
  initialPlacementsRef.current = initialPlacements

  // Track which placement IDs have been rendered to avoid duplicates
  const renderedPlacementIdsRef = useRef<Set<string>>(new Set())

  const [isLoading, setIsLoading] = useState(true)
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('scripts')
  const [translationProgress, setTranslationProgress] = useState(0)
  const [isIndeterminate, setIsIndeterminate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urn, setUrn] = useState<string | undefined>(initialUrn)
  const [isCacheHit, setIsCacheHit] = useState(false)
  const [measureMode, setMeasureMode] = useState<MeasureMode>('none')
  const [hasMeasurement, setHasMeasurement] = useState(false)
  const [hasSelectedMarker, setHasSelectedMarker] = useState(false)
  const [dwgCoordinates, setDwgCoordinates] = useState<DwgCoordinates | null>(null)
  const [dwgUnitString, setDwgUnitString] = useState<string | null>(null)

  // ═══════════════════════════════════════════════════════════════════════════
  // COORDINATE TRANSFORMATION (2D DWGs)
  // ═══════════════════════════════════════════════════════════════════════════
  // APS Viewer uses 2-stage coordinates for 2D DWGs:
  //   Screen (pixels) → Page (viewer internal) → DWG Model Space
  //
  // - PlacementTool outputs PAGE coordinates (from visible bounds or snapper)
  // - We convert Page→DWG for storage/export (LISP scripts need DWG coords)
  // - We convert DWG→Page for marker rendering (markers positioned in page space)
  //
  // Transform source: model.getPageToModelTransform(1) - viewport 1 = model space
  // See: https://aps.autodesk.com/blog/parsing-line-points-viewer
  // ═══════════════════════════════════════════════════════════════════════════

  // Page-to-Model transformation stored as plain numbers for reliable access
  // Format: [scaleX, scaleY, translateX, translateY] from Matrix4 column-major layout
  // Lazily extracted on first use (not available during GEOMETRY_LOADED event)
  const pageToModelTransformRef = useRef<[number, number, number, number] | null>(null)

  /**
   * Convert page coordinates (from APS viewer) to DWG model space coordinates.
   * Uses matrix elements from getPageToModelTransform(vpId=1).
   * Lazily extracts transform on first use (not available during geometry load).
   */
  const pageToDwgCoords = useCallback((pageX: number, pageY: number): { x: number; y: number } => {
    // Lazy extraction: get transform from viewer if not cached
    if (!pageToModelTransformRef.current && viewerRef.current?.model) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = viewerRef.current.model as any
      const matrix = model.getPageToModelTransform?.(1)
      if (matrix?.elements) {
        const e = matrix.elements
        // Extract [scaleX, scaleY, translateX, translateY] from Matrix4 (column-major)
        pageToModelTransformRef.current = [e[0], e[5], e[12], e[13]]
        console.log('[PlannerViewer] Lazy-loaded page-to-model transform:', pageToModelTransformRef.current)
      }
    }

    const transform = pageToModelTransformRef.current
    if (!transform) {
      return { x: pageX, y: pageY }
    }

    const [scaleX, scaleY, translateX, translateY] = transform

    // Apply affine transformation: result = scale * input + translate
    const dwgX = scaleX * pageX + translateX
    const dwgY = scaleY * pageY + translateY

    return { x: dwgX, y: dwgY }
  }, [])

  /**
   * Convert DWG model space coordinates to page coordinates (for marker positioning).
   * Inverse of pageToDwgCoords: pageX = (dwgX - translateX) / scaleX
   */
  const dwgToPageCoords = useCallback((dwgX: number, dwgY: number): { x: number; y: number } => {
    // Ensure transform is loaded (uses same lazy extraction)
    if (!pageToModelTransformRef.current && viewerRef.current?.model) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = viewerRef.current.model as any
      const matrix = model.getPageToModelTransform?.(1)
      if (matrix?.elements) {
        const e = matrix.elements
        pageToModelTransformRef.current = [e[0], e[5], e[12], e[13]]
        console.log('[PlannerViewer] Lazy-loaded page-to-model transform:', pageToModelTransformRef.current)
      }
    }

    const transform = pageToModelTransformRef.current
    if (!transform) {
      return { x: dwgX, y: dwgY }
    }

    const [scaleX, scaleY, translateX, translateY] = transform

    // Inverse affine: pageX = (dwgX - translateX) / scaleX
    const pageX = (dwgX - translateX) / scaleX
    const pageY = (dwgY - translateY) / scaleY

    return { x: pageX, y: pageY }
  }, [])

  // Get viewer token from API
  const getAccessToken = useCallback(async (): Promise<{ access_token: string; expires_in: number }> => {
    const response = await fetch('/api/viewer/auth')
    if (!response.ok) {
      throw new Error('Failed to get viewer token')
    }
    return response.json()
  }, [])

  // Upload file and get URN
  // Uses planner API with persistent storage when projectId is provided
  const uploadFile = useCallback(async (): Promise<string> => {
    if (!file) throw new Error('No file provided')

    setLoadingStage('upload')

    const formData = new FormData()
    formData.append('file', file)

    // Use planner API for persistent storage with caching
    // Requires both projectId and areaRevisionId
    if (projectId && areaRevisionId) {
      formData.append('projectId', projectId)
      formData.append('areaRevisionId', areaRevisionId)

      const response = await fetch('/api/planner/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json() as {
        urn: string
        isNewUpload: boolean
        bucketName: string
        fileName: string
      }

      // Check if this was a cache hit (same file already translated)
      if (!data.isNewUpload) {
        setIsCacheHit(true)
        setLoadingStage('cache-hit')
        // Brief pause to show cache hit message
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      onUploadCompleteRef.current?.(data.urn, data.isNewUpload, data.fileName)
      return data.urn
    }

    // Fallback to transient viewer API (no caching)
    const response = await fetch('/api/viewer/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Upload failed')
    }

    const data = await response.json()
    return data.urn
  }, [file, projectId, onUploadComplete])

  // Poll translation status
  // Uses planner API when projectId is provided for consistency
  const pollTranslationStatus = useCallback(async (fileUrn: string): Promise<void> => {
    // Skip translation polling if cache hit (already translated)
    if (isCacheHit) {
      return
    }

    setLoadingStage('translation')

    const poll = async (): Promise<void> => {
      // Use planner status endpoint when projectId is provided
      const endpoint = projectId
        ? `/api/planner/status/${encodeURIComponent(fileUrn)}`
        : `/api/viewer/status/${encodeURIComponent(fileUrn)}`
      const response = await fetch(endpoint)
      if (!response.ok) {
        throw new Error('Failed to get translation status')
      }

      const status: TranslationStatus = await response.json()

      // Extract progress percentage from "50% complete" or similar
      const progressMatch = status.progress?.match(/(\d+)/)
      const progressValue = progressMatch ? parseInt(progressMatch[1], 10) : 0
      setTranslationProgress(progressValue)

      // APS often reports 0% for DWG→SVF2 translations throughout the process
      // Show indeterminate progress when status is inprogress but progress is 0%
      if (status.status === 'inprogress' && progressValue === 0) {
        setIsIndeterminate(true)
      } else {
        setIsIndeterminate(false)
      }

      if (status.status === 'success') {
        // Ensure progress shows 100% on completion
        setTranslationProgress(100)
        setIsIndeterminate(false)
        // Notify parent that translation is complete
        onTranslationCompleteRef.current?.(fileUrn)
        return
      }

      if (status.status === 'failed') {
        throw new Error(status.messages?.join('\n') || 'Translation failed')
      }

      await new Promise(resolve => setTimeout(resolve, 2000))
      return poll()
    }

    return poll()
  }, [isCacheHit, projectId])

  // Initialize viewer with Viewer3D (no GUI)
  const initializeViewer = useCallback(async (fileUrn: string): Promise<void> => {
    if (!containerRef.current) return

    setLoadingStage('viewer')

    const tokenData = await getAccessToken()

    return new Promise((resolve, reject) => {
      const options: ViewerInitOptions = {
        env: 'AutodeskProduction2',
        api: 'streamingV2_EU',
        getAccessToken: (callback) => {
          callback(tokenData.access_token, tokenData.expires_in)
        },
      }

      window.Autodesk.Viewing.Initializer(options, () => {
        if (!containerRef.current) {
          reject(new Error('Container not found'))
          return
        }

        // Use Viewer3D instead of GuiViewer3D - no built-in toolbar!
        // Extensions:
        // - Measure: for measurement tools (includes snapping)
        // - MarkupsCore: for product placement markers (SVG layer with auto zoom/pan)
        const viewer = new window.Autodesk.Viewing.Viewer3D(containerRef.current, {
          extensions: [
            'Autodesk.Measure',
            'Autodesk.Viewing.MarkupsCore',
          ],
        })

        viewer.start()
        viewer.setTheme(initialTheme === 'dark' ? 'dark-theme' : 'light-theme')

        viewerRef.current = viewer

        // Set default navigation behavior
        viewer.navigation.setZoomTowardsPivot(true)

        // Apply user zoom direction preference
        viewer.setReverseZoomDirection(reverseZoomDirection)

        // Load the document
        const documentId = `urn:${fileUrn}`
        window.Autodesk.Viewing.Document.load(
          documentId,
          async (doc) => {
            const viewable = doc.getRoot().getDefaultGeometry()
            if (!viewable) {
              reject(new Error('No viewable geometry found'))
              return
            }

            try {
              // Load without globalOffset - let viewer use natural page-to-model transform
              // This allows getPageToModelTransform() to return the correct matrix
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (viewer as any).loadDocumentNode(doc, viewable)

              // Set background color AFTER document loads (loading resets it)
              // API: (topR, topG, topB, bottomR, bottomG, bottomB) - colors are inverted (255-x)
              if (initialTheme === 'dark') {
                const topRgb = hexToRgb(viewerBgTopColor)
                const bottomRgb = hexToRgb(viewerBgBottomColor)
                // Invert colors: viewer interprets 0 as white, 255 as black
                viewer.setBackgroundColor(
                  255 - topRgb.r, 255 - topRgb.g, 255 - topRgb.b,
                  255 - bottomRgb.r, 255 - bottomRgb.g, 255 - bottomRgb.b
                )
              } else {
                // Light theme: light gray gradient (inverted: 240->15, 224->31)
                viewer.setBackgroundColor(15, 15, 15, 31, 31, 31)
              }

              // Extract DWG unit information from the model
              const model = viewer.model
              let modelUnitScale: number | null = null
              if (model) {
                const unitInfo: DwgUnitInfo = {
                  unitString: model.getUnitString?.() ?? null,
                  displayUnit: model.getDisplayUnit?.() ?? null,
                  unitScale: model.getUnitScale?.() ?? null,
                  pageUnits: (model.getMetadata?.('page_dimensions', 'page_units', null) as string | null) ?? null,
                  modelUnits: (model.getMetadata?.('page_dimensions', 'model_units', null) as string | null) ?? null,
                }
                modelUnitScale = unitInfo.unitScale
                console.log('[PlannerViewer] DWG unit info:', unitInfo)
                console.log('[PlannerViewer] Raw getUnitScale():', model.getUnitScale?.())
                // Store unit string for coordinate display
                setDwgUnitString(unitInfo.modelUnits || unitInfo.unitString)
                onUnitInfoAvailableRef.current?.(unitInfo)
                // Note: page-to-model transform is lazily extracted in pageToDwgCoords()
                // because it's not reliable during geometry load event
              }

              // Initialize MarkupMarkers for product placement
              const markers = new MarkupMarkers(viewer, markerMinScreenPx)
              const markersInitialized = await markers.initialize()
              if (markersInitialized) {
                markupMarkersRef.current = markers
                // Set model unit scale for proper SVG symbol sizing
                // This converts SVG mm values to model units based on the DWG's unit system
                if (modelUnitScale !== null) {
                  markers.setModelUnitScale(modelUnitScale)
                }
                // Set callbacks for marker selection/deletion
                markers.setCallbacks(
                  (id) => setHasSelectedMarker(id !== null),
                  (id) => {
                    console.log('[PlannerViewer] Marker deleted:', id)
                    // Also remove from parent's placements state
                    onPlacementDeleteRef.current?.(id)
                  }
                )
                console.log('[PlannerViewer] MarkupMarkers initialized')
              } else {
                console.warn('[PlannerViewer] MarkupMarkers failed to initialize')
              }

              // Register the placement tool with snapping support and coordinate tracking
              const tool = new PlacementTool(
                viewer,
                (coords) => {
                  const mode = placementModeRef.current
                  if (mode && markupMarkersRef.current) {
                    const placementId = crypto.randomUUID()
                    const productData = {
                      productId: mode.productId,
                      projectProductId: mode.projectProductId,
                      productName: mode.fossPid || mode.description,
                      symbol: mode.symbol,  // Symbol label for marker display
                    }

                    let markerData
                    if (coords.isSnapped) {
                      // Use world coordinates for marker placement (snapped)
                      markerData = markupMarkersRef.current.addMarkerAtWorld(
                        coords.worldX,
                        coords.worldY,
                        coords.worldZ,
                        productData,
                        placementId
                      )
                      // Fallback to screen coords if world conversion fails
                      if (!markerData) {
                        console.warn('[PlannerViewer] World coords failed, using screen coords')
                        markerData = markupMarkersRef.current.addMarkerAtScreen(
                          coords.screenX,
                          coords.screenY,
                          productData,
                          placementId
                        )
                      }
                    } else {
                      // Use screen coordinates for non-snapped placements
                      markerData = markupMarkersRef.current.addMarkerAtScreen(
                        coords.screenX,
                        coords.screenY,
                        productData,
                        placementId
                      )
                    }

                    if (markerData) {
                      // Track this placement as rendered to prevent duplicate markers
                      renderedPlacementIdsRef.current.add(placementId)

                      // Convert page coords to DWG model space for storage/export
                      const dwg = pageToDwgCoords(coords.worldX, coords.worldY)
                      console.log('[PlannerViewer] Placed marker:', {
                        id: placementId,
                        pageX: coords.worldX.toFixed(2),
                        pageY: coords.worldY.toFixed(2),
                        dwgX: dwg.x.toFixed(2),
                        dwgY: dwg.y.toFixed(2),
                        isSnapped: coords.isSnapped,
                        snapType: coords.snapType,
                      })
                      // Store DWG model space coordinates for persistence / LISP export
                      onPlacementAddRef.current?.({
                        id: placementId,
                        productId: mode.productId,
                        projectProductId: mode.projectProductId,
                        productName: mode.fossPid || mode.description,
                        symbol: mode.symbol,  // Symbol label for persistence
                        worldX: dwg.x,
                        worldY: dwg.y,
                        rotation: 0,
                      })
                    } else {
                      console.warn('[PlannerViewer] markerData is null - marker not placed')
                    }
                  }
                },
                undefined, // onSnapChange - not used currently
                // onCoordinateChange - convert page coords to DWG model coords for display
                (coords) => {
                  if (!coords) {
                    setDwgCoordinates(null)
                    return
                  }
                  // Convert page coords (from viewer) to DWG model space
                  const dwg = pageToDwgCoords(coords.x, coords.y)
                  setDwgCoordinates({
                    x: dwg.x,
                    y: dwg.y,
                    isSnapped: coords.isSnapped,
                    snapType: coords.snapType,
                  })
                }
              )
              viewer.toolController.registerTool(tool)
              placementToolRef.current = tool

              // Render initial placements (loaded from database)
              // Placements store DWG coords, convert to page coords for marker positioning
              if (initialPlacementsRef.current?.length && markupMarkersRef.current) {
                console.log('[PlannerViewer] Rendering', initialPlacementsRef.current.length, 'initial placements')
                for (const placement of initialPlacementsRef.current) {
                  if (renderedPlacementIdsRef.current.has(placement.id)) continue

                  // Convert DWG coords (from database) to page coords for marker positioning
                  const pageCoords = dwgToPageCoords(placement.worldX, placement.worldY)
                  markupMarkersRef.current.addMarkerAtWorld(
                    pageCoords.x,
                    pageCoords.y,
                    0, // Z coord
                    {
                      productId: placement.productId,
                      projectProductId: placement.projectProductId,
                      productName: placement.productName,
                      symbol: placement.symbol,  // Symbol label from database
                    },
                    placement.id
                  )
                  renderedPlacementIdsRef.current.add(placement.id)
                }
                console.log('[PlannerViewer] Initial placements rendered')
              }

              // Activate pan tool by default (mouse wheel zooms, drag pans)
              viewer.toolController.activateTool('pan')
              setIsLoading(false)
              onReadyRef.current?.(viewer)
              resolve()
            } catch (err) {
              reject(err)
            }
          },
          (errorCode, errorMsg) => {
            reject(new Error(`Document load failed: ${errorMsg} (${errorCode})`))
          }
        )
      })
    })
  }, [getAccessToken, initialTheme, markerMinScreenPx, reverseZoomDirection])

  // Main initialization effect - runs once per file
  useEffect(() => {
    // Prevent double initialization (React Strict Mode)
    if (isInitializedRef.current) {
      return
    }

    let mounted = true
    let cleanup: (() => void) | undefined

    const initialize = async () => {
      try {
        isInitializedRef.current = true

        setLoadingStage('scripts')
        await loadAutodeskScripts()

        if (!mounted) return

        let fileUrn = urn

        if (!fileUrn && file) {
          fileUrn = await uploadFile()
          if (!mounted) return
          setUrn(fileUrn)
        }

        if (!fileUrn) {
          throw new Error('No URN available')
        }

        await pollTranslationStatus(fileUrn)
        if (!mounted) return

        await initializeViewer(fileUrn)

        cleanup = () => {
          if (viewerRef.current) {
            viewerRef.current.finish()
            viewerRef.current = null
          }
        }
      } catch (err) {
        if (!mounted) return
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        setIsLoading(false)
        onErrorRef.current?.(errorMessage)
      }
    }

    initialize()

    return () => {
      mounted = false
      isInitializedRef.current = false
      renderedPlacementIdsRef.current.clear() // Reset rendered placements tracking
      cleanup?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urn, file])

  // Handle click events for placing products
  useEffect(() => {
    if (!onViewerClick || !viewerRef.current) return

    const container = containerRef.current
    if (!container) return

    const handleClick = (e: MouseEvent) => {
      const viewer = viewerRef.current
      if (!viewer) return

      const rect = container.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top

      let worldCoords: WorldCoordinates | null = null
      if (viewer.clientToWorld) {
        const result = viewer.clientToWorld(e.clientX, e.clientY)
        if (result?.point) {
          worldCoords = { x: result.point.x, y: result.point.y, z: result.point.z }
        }
      }

      onViewerClick(worldCoords, { x: screenX, y: screenY })
    }

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [onViewerClick])

  // Handle resize (window and container)
  useEffect(() => {
    const container = containerRef.current

    const handleResize = () => {
      viewerRef.current?.resize()
    }

    // Window resize
    window.addEventListener('resize', handleResize)

    // Container resize (e.g., sidebar collapse)
    let resizeObserver: ResizeObserver | null = null
    if (container) {
      resizeObserver = new ResizeObserver(() => {
        // Small delay to let CSS transitions complete
        requestAnimationFrame(() => {
          viewerRef.current?.resize()
        })
      })
      resizeObserver.observe(container)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver?.disconnect()
    }
  }, [])

  // Prevent wheel events from propagating
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const preventScroll = (e: WheelEvent) => {
      e.stopPropagation()
    }

    container.addEventListener('wheel', preventScroll, { passive: false })
    return () => container.removeEventListener('wheel', preventScroll)
  }, [])

  // Track mouse position for coordinate display (when not in placement mode)
  // In placement mode, PlacementTool handles this with snapping
  useEffect(() => {
    const container = containerRef.current
    const viewer = viewerRef.current
    if (!container || !viewer || isLoading) return

    // Skip if placement mode is active (PlacementTool handles coordinates with snapping)
    if (placementMode) return

    const handleMouseMove = (e: MouseEvent) => {
      let viewerX: number | undefined
      let viewerY: number | undefined

      // Calculate page coords from visible bounds
      // Note: clientToWorld() is unreliable for 2D DWGs, so we always use visible bounds
      const impl = viewer.impl
      const visibleBounds = impl?.getVisibleBounds?.()
      if (visibleBounds) {
        const rect = container.getBoundingClientRect()
        const localX = e.clientX - rect.left
        const localY = e.clientY - rect.top
        const visWidth = visibleBounds.max.x - visibleBounds.min.x
        const visHeight = visibleBounds.max.y - visibleBounds.min.y
        // Page coords: X increases right, Y increases up (flip from screen)
        viewerX = visibleBounds.min.x + (localX / rect.width) * visWidth
        viewerY = visibleBounds.max.y - (localY / rect.height) * visHeight
      }

      // Convert page coords to DWG model coords for display
      if (viewerX !== undefined && viewerY !== undefined) {
        const dwg = pageToDwgCoords(viewerX, viewerY)
        setDwgCoordinates({ x: dwg.x, y: dwg.y, isSnapped: false })
      }
    }

    const handleMouseLeave = () => {
      setDwgCoordinates(null)
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [isLoading, placementMode])

  // ESC key to exit placement mode
  useEffect(() => {
    if (!placementMode) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExitPlacementMode?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [placementMode, onExitPlacementMode])

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
  }, [placementMode, measureMode])

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
        placement.id
      )
      renderedPlacementIdsRef.current.add(placement.id)
      newlyRendered++
    }

    if (newlyRendered > 0) {
      console.log('[PlannerViewer] Rendered', newlyRendered, 'late-arriving placements')
    }
  }, [initialPlacements, isLoading])

  // Toolbar actions
  const handleToggleMeasure = useCallback((mode: 'distance' | 'area') => {
    const viewer = viewerRef.current
    if (!viewer) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const measureExt = viewer.getExtension('Autodesk.Measure') as any
    if (!measureExt) return

    // Exit placement mode when entering measure mode
    if (placementMode) {
      onExitPlacementMode?.()
    }

    if (measureMode === mode) {
      // Same mode clicked - deactivate
      measureExt.deactivate()
      setMeasureMode('none')
    } else {
      // Different mode or none - activate new mode
      measureExt.activate(mode)
      setMeasureMode(mode)
    }
  }, [measureMode, placementMode, onExitPlacementMode])

  const handleClearMeasurements = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const measureExt = viewer.getExtension('Autodesk.Measure') as any
    if (!measureExt) return

    // Clear all measurements
    measureExt.deleteCurrentMeasurement()
    setHasMeasurement(false)
  }, [])

  const handleDeleteSelectedMarker = useCallback(() => {
    markupMarkersRef.current?.deleteSelected()
  }, [])

  const handleFitAll = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // Simple approach: setViewFromFile resets to the default view from the DWG
    console.log('[FitAll] Calling setViewFromFile()...')
    viewer.setViewFromFile()
  }, [])

  // Poll for measurements while in measure mode
  useEffect(() => {
    if (measureMode === 'none') {
      return
    }

    const viewer = viewerRef.current
    if (!viewer) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const measureExt = viewer.getExtension('Autodesk.Measure') as any
    if (!measureExt) return

    const checkForMeasurements = () => {
      const measureTool = measureExt.measureTool
      if (measureTool) {
        // Check if there's a current measurement
        const hasMeasure = measureTool._currentMeasurement != null ||
                          (measureTool._measurementsManager?.getMeasurementList?.()?.length > 0)
        setHasMeasurement(hasMeasure)
      }
    }

    // Check periodically while measuring
    const interval = setInterval(checkForMeasurements, 500)

    return () => clearInterval(interval)
  }, [measureMode])

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
        <PlannerViewerToolbar
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
