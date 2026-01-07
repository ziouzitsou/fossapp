/**
 * useViewerInit Hook
 *
 * Handles the complete initialization lifecycle of the APS Viewer:
 * 1. Load Autodesk scripts
 * 2. Upload file (if needed)
 * 3. Poll translation status
 * 4. Initialize Viewer3D
 * 5. Load document
 * 6. Set up extensions (Measure, Markups)
 * 7. Register PlacementTool
 * 8. Render initial placements
 *
 * This is the largest and most complex hook - it orchestrates the entire
 * viewer setup process.
 */

import { useEffect, useRef, useCallback, useLayoutEffect, type RefObject, type MutableRefObject } from 'react'
import type { Viewer3DInstance, ViewerInitOptions, Edit2DExtension, Edit2DContext } from '@/types/autodesk-viewer'
import type { Placement, PlacementModeProduct, DwgUnitInfo } from '../types'
import type { LoadingStage } from '../viewer-overlays'
import { PlacementTool, type DwgCoordinates } from '../placement-tool'
import { Edit2DMarkers } from '../edit2d-markers'
import { hexToRgb, loadAutodeskScripts } from '../case-study-viewer-utils'

interface UseViewerInitOptions {
  // Refs
  containerRef: RefObject<HTMLDivElement | null>
  viewerRef: MutableRefObject<Viewer3DInstance | null>
  placementToolRef: MutableRefObject<PlacementTool | null>
  renderedPlacementIdsRef: MutableRefObject<Set<string>>
  /** Edit2D extension context ref */
  edit2dContextRef: MutableRefObject<Edit2DContext | null>
  /** Edit2D markers manager ref */
  edit2dMarkersRef: MutableRefObject<Edit2DMarkers | null>

  // File/URN
  file?: File
  urn?: string
  setUrn: (urn: string | undefined) => void

  // Configuration
  initialTheme: 'light' | 'dark'
  markerMinScreenPx: number
  viewerBgTopColor: string
  viewerBgBottomColor: string
  reverseZoomDirection: boolean

  // Placement mode (accessed via ref in callbacks)
  placementModeRef: RefObject<PlacementModeProduct | null | undefined>

  // Initial placements to render
  initialPlacementsRef: RefObject<Placement[] | undefined>

  // Coordinate transformation functions
  pageToDwgCoords: (pageX: number, pageY: number) => { x: number; y: number }
  dwgToPageCoords: (dwgX: number, dwgY: number) => { x: number; y: number }
  setTransform: (scaleX: number, scaleY: number, translateX: number, translateY: number) => void

  // State setters
  setIsLoading: (loading: boolean) => void
  setLoadingStage: (stage: LoadingStage) => void
  setError: (error: string | null) => void
  setDwgUnitString: (unit: string | null) => void
  setDwgCoordinates: (coords: DwgCoordinates | null) => void
  setHasSelectedMarker: (has: boolean) => void
  setSelectedMarkerFossPid: (fossPid: string | null) => void
  setIsMoving: (moving: boolean) => void

  // Cache state
  isCacheHit: boolean

  // API functions
  getAccessToken: () => Promise<{ access_token: string; expires_in: number }>
  uploadFile: () => Promise<string>
  pollTranslationStatus: (fileUrn: string, skipIfCacheHit?: boolean) => Promise<void>

  // Callbacks
  onReady?: (viewer: Viewer3DInstance) => void
  onError?: (error: string) => void
  onUnitInfoAvailable?: (info: DwgUnitInfo) => void
  onPlacementAdd?: (placement: Omit<Placement, 'dbId'>) => void
  onPlacementDelete?: (id: string) => void
  onPlacementRotate?: (id: string, rotation: number) => void
  onPlacementMove?: (id: string, worldX: number, worldY: number) => void
}

interface UseViewerInitReturn {
  /** Whether initialization has completed */
  isInitialized: boolean
  /** Fit all elements in view */
  handleFitAll: () => void
}

export function useViewerInit({
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
  onUnitInfoAvailable,
  onPlacementAdd,
  onPlacementDelete,
  onPlacementRotate,
  onPlacementMove,
}: UseViewerInitOptions): UseViewerInitReturn {
  // Track if viewer has been initialized to prevent double init
  const isInitializedRef = useRef(false)

  // Use refs for callbacks to prevent re-initialization when parent re-renders
  const onReadyRef = useRef(onReady)
  const onErrorRef = useRef(onError)
  const onUnitInfoAvailableRef = useRef(onUnitInfoAvailable)
  const onPlacementAddRef = useRef(onPlacementAdd)
  const onPlacementDeleteRef = useRef(onPlacementDelete)
  const onPlacementRotateRef = useRef(onPlacementRotate)
  const onPlacementMoveRef = useRef(onPlacementMove)
  useLayoutEffect(() => {
    onReadyRef.current = onReady
    onErrorRef.current = onError
    onUnitInfoAvailableRef.current = onUnitInfoAvailable
    onPlacementAddRef.current = onPlacementAdd
    onPlacementDeleteRef.current = onPlacementDelete
    onPlacementRotateRef.current = onPlacementRotate
    onPlacementMoveRef.current = onPlacementMove
  }, [onReady, onError, onUnitInfoAvailable, onPlacementAdd, onPlacementDelete, onPlacementRotate, onPlacementMove])

  /**
   * Initialize viewer with Viewer3D (no GUI)
   */
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
        // WebGL fallback: show help link if user's browser doesn't support WebGL
        webGLHelpLink: '/support/graphics-requirements',
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

        const startCode = viewer.start()
        if (startCode > 0) {
          // Error code > 0 indicates WebGL failure
          reject(new Error('WEBGL_NOT_SUPPORTED'))
          return
        }
        viewer.setTheme(initialTheme === 'dark' ? 'dark-theme' : 'light-theme')

        // Set background color IMMEDIATELY to prevent white flash
        // (loading document will reset it, so we set it again after load)
        const topRgb = hexToRgb(viewerBgTopColor)
        const bottomRgb = hexToRgb(viewerBgBottomColor)
        viewer.setBackgroundColor(
          topRgb.r, topRgb.g, topRgb.b,
          bottomRgb.r, bottomRgb.g, bottomRgb.b
        )

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

              // Re-apply background color (document load resets it to default white)
              const topRgb = hexToRgb(viewerBgTopColor)
              const bottomRgb = hexToRgb(viewerBgBottomColor)
              viewer.setBackgroundColor(
                topRgb.r, topRgb.g, topRgb.b,
                bottomRgb.r, bottomRgb.g, bottomRgb.b
              )

              // Disable DWG element hover highlighting
              // The 2D rollover uses a hardcoded yellow shader that can't be customized,
              // so we disable it entirely. Our Edit2D markers handle their own hover effects.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const impl = (viewer as any).impl
              if (impl?.disableRollover) {
                impl.disableRollover(true)
              }
              if (impl?.disableHighlight) {
                impl.disableHighlight(true)
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
                // Store unit string for coordinate display
                setDwgUnitString(unitInfo.modelUnits || unitInfo.unitString)
                onUnitInfoAvailableRef.current?.(unitInfo)
                // Note: page-to-model transform is lazily extracted in pageToDwgCoords()
                // because it's not reliable during geometry load event
              }

              // ============================================================================
              // Extract page-to-model transform for coordinate conversion
              // ============================================================================
              // The matrix from getPageToModelTransform(1) tells us how page units
              // (used by Edit2D layer) relate to model units (mm in DWG)
              //
              // IMPORTANT: The transform is not immediately available after loadDocumentNode.
              // We defer extraction to allow the viewer to complete its setup.
              let extractedPageToModelScale = 1
              const waitForTransform = (): Promise<void> => {
                return new Promise((resolveTransform) => {
                  const tryExtract = (): boolean => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const m = (model as any).getPageToModelTransform?.(1)
                    if (m?.elements) {
                      // elements[0] is the X scale factor: 1 page unit = scaleX model units
                      const scaleX = Math.abs(m.elements[0])
                      const scaleY = Math.abs(m.elements[5])
                      const translateX = m.elements[12]
                      const translateY = m.elements[13]
                      // Only use if it's a real transform (not identity)
                      if (scaleX > 1.001 || scaleX < 0.999) {
                        setTransform(scaleX, scaleY, translateX, translateY)
                        extractedPageToModelScale = scaleX
                        return true
                      }
                    }
                    return false
                  }

                  // Try immediately
                  if (tryExtract()) {
                    resolveTransform()
                    return
                  }

                  // Defer to next frame when viewer has completed setup
                  requestAnimationFrame(() => {
                    if (tryExtract()) {
                      resolveTransform()
                      return
                    }

                    // Still identity? Try one more time after a short delay
                    setTimeout(() => {
                      if (!tryExtract()) {
                        console.warn('[useViewerInit] getPageToModelTransform returned identity, using empirical fallback')
                        // Fallback based on unit scale (old empirical approach)
                        const fallbackScale = modelUnitScale === 0.001 ? 13.5 : 1
                        setTransform(fallbackScale, fallbackScale, 0, 0)
                        extractedPageToModelScale = fallbackScale
                      }
                      resolveTransform()
                    }, 100)
                  })
                })
              }

              // Wait for transform before continuing (needed for correct initial placement positioning)
              await waitForTransform()

              // ============================================================================
              // Initialize Edit2D Extension
              // ============================================================================
              // Edit2D provides managed shapes with built-in selection, move, rotate gizmos.
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const edit2d = await (viewer as any).loadExtension('Autodesk.Edit2D') as Edit2DExtension
                if (edit2d) {
                  // Register default tools (insertSymbolTool, polygonTool, etc.)
                  edit2d.registerDefaultTools()

                  // Store the context for future marker operations
                  edit2dContextRef.current = edit2d.defaultContext

                  // Initialize Edit2DMarkers for product placement
                  const edit2dMarkers = new Edit2DMarkers(viewer)
                  const edit2dMarkersInitialized = await edit2dMarkers.initialize(edit2d.defaultContext)

                  if (edit2dMarkersInitialized) {
                    edit2dMarkersRef.current = edit2dMarkers

                    // Set unit scales for proper symbol sizing
                    if (modelUnitScale !== null) {
                      edit2dMarkers.setUnitScales(modelUnitScale, extractedPageToModelScale)
                    }

                    // Set minimum marker size from user preferences
                    edit2dMarkers.setMinScreenPx(markerMinScreenPx)

                    // Wire up callbacks for marker events
                    edit2dMarkers.setCallbacks({
                      onSelect: (id) => {
                        setHasSelectedMarker(id !== null)
                        // Look up fossPid from placements for toolbar display
                        if (id) {
                          const placement = initialPlacementsRef.current?.find(p => p.id === id)
                          setSelectedMarkerFossPid(placement?.fossPid ?? null)
                        } else {
                          setSelectedMarkerFossPid(null)
                        }
                      },
                      onDelete: (id) => {
                        onPlacementDeleteRef.current?.(id)
                      },
                      onRotate: (id, rotation) => {
                        onPlacementRotateRef.current?.(id, rotation)
                      },
                      onMove: (id, pageX, pageY) => {
                        // Convert page coords to DWG coords for storage
                        const dwg = pageToDwgCoords(pageX, pageY)
                        onPlacementMoveRef.current?.(id, dwg.x, dwg.y)
                      },
                      onMoveStart: () => {
                        setIsMoving(true)
                      },
                      onMoveEnd: () => {
                        setIsMoving(false)
                      },
                    })

                    // Activate polygonEditTool to enable selection/manipulation of Edit2D shapes
                    // Without an active Edit2D tool, clicks go to DWG viewer instead
                    const polygonEditToolName = edit2d.defaultTools?.polygonEditTool?.getName?.()
                    if (polygonEditToolName) {
                      viewer.toolController.activateTool(polygonEditToolName)

                      // Disable vertex/edge editing gizmos - we only want move/rotate, not geometry editing
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const polygonEditTool = edit2d.defaultTools?.polygonEditTool as any
                      if (polygonEditTool) {
                        polygonEditTool.setAllGizmosEnabled?.(false)
                        polygonEditTool.vertexMoveTool?.setAllGizmosEnabled?.(false)
                        polygonEditTool.edgeMoveTool?.setAllGizmosEnabled?.(false)
                      }
                    }
                  } else {
                    console.warn('[useViewerInit] Edit2DMarkers failed to initialize')
                  }
                }
              } catch (edit2dError) {
                console.error('[useViewerInit] Edit2D extension failed to load:', edit2dError)
              }
              // ============================================================================

              // Register the placement tool with snapping support and coordinate tracking
              const tool = new PlacementTool(
                viewer,
                (coords) => {
                  // Check if we're in move mode - if so, confirm the move instead of placing
                  if (edit2dMarkersRef.current?.isMoving()) {
                    edit2dMarkersRef.current.confirmMove(coords.worldX, coords.worldY)
                    return
                  }

                  const mode = placementModeRef.current
                  if (!mode || !edit2dMarkersRef.current) return

                  const placementId = crypto.randomUUID()

                  // Convert page coords to DWG model space for storage/export
                  const dwg = pageToDwgCoords(coords.worldX, coords.worldY)

                  // Create Edit2D marker
                  edit2dMarkersRef.current.addMarker(
                    coords.worldX,  // page coords
                    coords.worldY,
                    {
                      productId: mode.productId,
                      projectProductId: mode.projectProductId,
                      productName: mode.fossPid || mode.description,
                      fossPid: mode.fossPid,
                      symbol: mode.symbol,
                    },
                    placementId,
                    0  // Initial rotation
                  )

                  // Track this placement as rendered
                  renderedPlacementIdsRef.current.add(placementId)

                  // Store DWG model space coordinates for persistence / LISP export
                  onPlacementAddRef.current?.({
                    id: placementId,
                    productId: mode.productId,
                    projectProductId: mode.projectProductId,
                    productName: mode.fossPid || mode.description,
                    symbol: mode.symbol,
                    worldX: dwg.x,
                    worldY: dwg.y,
                    rotation: 0,
                  })
                },
                undefined, // onSnapChange - not used currently
                // onCoordinateChange - convert page coords to DWG model coords for display
                // Also updates move preview when in move mode
                (coords) => {
                  if (!coords) {
                    setDwgCoordinates(null)
                    return
                  }

                  // Update move preview if in move mode
                  if (edit2dMarkersRef.current?.isMoving()) {
                    edit2dMarkersRef.current.updateMovePreview(coords.x, coords.y)
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
              if (initialPlacementsRef.current?.length && edit2dMarkersRef.current) {
                for (const placement of initialPlacementsRef.current) {
                  if (renderedPlacementIdsRef.current.has(placement.id)) continue

                  // Convert DWG coords (from database) to page coords for marker positioning
                  const pageCoords = dwgToPageCoords(placement.worldX, placement.worldY)

                  // Create Edit2D marker
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
              }

              // Note: polygonEditTool is already activated for Edit2D marker selection
              // Pan/zoom still works via mouse wheel and right-click drag
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
  }, [
    containerRef,
    viewerRef,
    placementToolRef,
    renderedPlacementIdsRef,
    edit2dContextRef,
    edit2dMarkersRef,
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
    setDwgUnitString,
    setDwgCoordinates,
    setHasSelectedMarker,
    setSelectedMarkerFossPid,
    setIsMoving,
    getAccessToken,
  ])

  /**
   * Main initialization effect - runs once per file
   */
  useEffect(() => {
    // Prevent double initialization (React Strict Mode)
    if (isInitializedRef.current) {
      return
    }

    let mounted = true
    let cleanup: (() => void) | undefined
    // Capture ref value for cleanup (React warns if refs change before cleanup runs)
    const placementIdsSet = renderedPlacementIdsRef.current

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

        await pollTranslationStatus(fileUrn, isCacheHit)
        if (!mounted) return

        await initializeViewer(fileUrn)

        cleanup = () => {
          // Dispose Edit2DMarkers
          edit2dMarkersRef.current?.dispose()
          edit2dMarkersRef.current = null

          // Clear Edit2D context
          // The extension is unloaded automatically when viewer.finish() is called
          edit2dContextRef.current = null

          // Dispose PlacementTool (deactivates snapper)
          if (placementToolRef.current && viewerRef.current) {
            viewerRef.current.toolController.deactivateTool('placement-tool')
            placementToolRef.current = null
          }

          // Finish viewer last
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
      placementIdsSet.clear() // Reset rendered placements tracking
      cleanup?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urn, file])

  /**
   * Fit all elements in view
   */
  const handleFitAll = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // Simple approach: setViewFromFile resets to the default view from the DWG
    viewer.setViewFromFile()
  }, [viewerRef])

  return {
    isInitialized: isInitializedRef.current,
    handleFitAll,
  }
}
