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
import { MarkupMarkers } from '../markup-markers'
import { Edit2DMarkers } from '../edit2d-markers'
import { hexToRgb, loadAutodeskScripts } from '../case-study-viewer-utils'

interface UseViewerInitOptions {
  // Refs
  containerRef: RefObject<HTMLDivElement | null>
  viewerRef: MutableRefObject<Viewer3DInstance | null>
  placementToolRef: MutableRefObject<PlacementTool | null>
  markupMarkersRef: MutableRefObject<MarkupMarkers | null>
  renderedPlacementIdsRef: MutableRefObject<Set<string>>
  /** Edit2D extension context ref - for Phase 4B migration */
  edit2dContextRef: MutableRefObject<Edit2DContext | null>
  /** Edit2D markers manager ref - for Phase 4B migration */
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
  markupMarkersRef,
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
  useLayoutEffect(() => {
    onReadyRef.current = onReady
    onErrorRef.current = onError
    onUnitInfoAvailableRef.current = onUnitInfoAvailable
    onPlacementAddRef.current = onPlacementAdd
    onPlacementDeleteRef.current = onPlacementDelete
    onPlacementRotateRef.current = onPlacementRotate
  }, [onReady, onError, onUnitInfoAvailable, onPlacementAdd, onPlacementDelete, onPlacementRotate])

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
                console.log('[useViewerInit] DWG unit info:', unitInfo)
                console.log('[useViewerInit] Raw getUnitScale():', model.getUnitScale?.())
                // Store unit string for coordinate display
                setDwgUnitString(unitInfo.modelUnits || unitInfo.unitString)
                onUnitInfoAvailableRef.current?.(unitInfo)
                // Note: page-to-model transform is lazily extracted in pageToDwgCoords()
                // because it's not reliable during geometry load event
              }

              // Initialize MarkupMarkers for product placement
              const markers = new MarkupMarkers(viewer, markerMinScreenPx)
              const markersInitialized = await markers.initialize()
              // Track pageToModelScale for use by Edit2DMarkers later
              let extractedPageToModelScale = 1
              if (markersInitialized) {
                markupMarkersRef.current = markers
                // Set model unit scale for proper SVG symbol sizing
                // This converts SVG mm values to model units based on the DWG's unit system
                if (modelUnitScale !== null) {
                  markers.setModelUnitScale(modelUnitScale)
                }

                // Extract page-to-model transform for accurate SVG symbol scaling
                // The matrix from getPageToModelTransform(1) tells us how page units
                // (used by MarkupsCore SVG layer) relate to model units (mm in DWG)
                //
                // IMPORTANT: The transform is not immediately available after loadDocumentNode.
                // We defer extraction to allow the viewer to complete its setup.
                // Returns a Promise that resolves when the transform is ready.
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
                          console.log('[useViewerInit] Page-to-model transform:', {
                            scaleX,
                            scaleY,
                            translateX,
                            translateY,
                          })
                          // Update both MarkupMarkers (for SVG scaling) and coordinate transform (for DB storage)
                          markers.setPageToModelScale(scaleX)
                          setTransform(scaleX, scaleY, translateX, translateY)
                          // Store for Edit2DMarkers
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
                          // For mm DWGs, the markup layer typically uses ~13-14 mm per page unit
                          const fallbackScale = modelUnitScale === 0.001 ? 13.5 : 1
                          markers.setPageToModelScale(fallbackScale)
                          // Also set coordinate transform (with 0,0 translate as approximation)
                          setTransform(fallbackScale, fallbackScale, 0, 0)
                          // Store for Edit2DMarkers
                          extractedPageToModelScale = fallbackScale
                        }
                        resolveTransform()
                      }, 100)
                    })
                  })
                }

                // Wait for transform before continuing (needed for correct initial placement positioning)
                await waitForTransform()
                // Set callbacks for marker selection/deletion/rotation
                markers.setCallbacks(
                  (id) => setHasSelectedMarker(id !== null),
                  (id) => {
                    console.log('[useViewerInit] Marker deleted:', id)
                    // Also remove from parent's placements state
                    onPlacementDeleteRef.current?.(id)
                  },
                  (id, rotation) => {
                    console.log('[useViewerInit] Marker rotated:', id, rotation)
                    // Update rotation in parent's placements state
                    onPlacementRotateRef.current?.(id, rotation)
                  }
                )
                console.log('[useViewerInit] MarkupMarkers initialized')
              } else {
                console.warn('[useViewerInit] MarkupMarkers failed to initialize')
              }

              // ============================================================================
              // Phase 4B: Initialize Edit2D Extension
              // ============================================================================
              // Edit2D provides managed shapes with built-in selection, move, rotate gizmos.
              // This will eventually replace the MarkupsCore direct SVG manipulation.
              // For now, we load it in parallel to verify it works correctly.
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const edit2d = await (viewer as any).loadExtension('Autodesk.Edit2D') as Edit2DExtension
                if (edit2d) {
                  // Register default tools (insertSymbolTool, polygonTool, etc.)
                  edit2d.registerDefaultTools()

                  // Store the context for future marker operations
                  edit2dContextRef.current = edit2d.defaultContext

                  // Log Edit2D initialization info
                  console.log('[useViewerInit] Edit2D extension initialized')
                  console.log('[useViewerInit] Edit2D context:', {
                    layer: edit2d.defaultContext.layer,
                    hasSelection: !!edit2d.defaultContext.selection,
                    hasUndoStack: !!edit2d.defaultContext.undoStack,
                    tools: Object.keys(edit2d.defaultTools || {}),
                  })

                  // Initialize Edit2DMarkers (runs in parallel with MarkupsCore for now)
                  const edit2dMarkers = new Edit2DMarkers(viewer)
                  const edit2dMarkersInitialized = await edit2dMarkers.initialize(edit2d.defaultContext)

                  if (edit2dMarkersInitialized) {
                    edit2dMarkersRef.current = edit2dMarkers

                    // Set unit scales for proper symbol sizing
                    // Use the same scales as MarkupMarkers (extracted in waitForTransform)
                    if (modelUnitScale !== null) {
                      edit2dMarkers.setUnitScales(modelUnitScale, extractedPageToModelScale)
                    }

                    // Wire up callbacks (same pattern as MarkupMarkers)
                    edit2dMarkers.setCallbacks({
                      onSelect: (id) => {
                        console.log('[useViewerInit] Edit2D marker selected:', id)
                        setHasSelectedMarker(id !== null)
                      },
                      onDelete: (id) => {
                        console.log('[useViewerInit] Edit2D marker deleted:', id)
                        onPlacementDeleteRef.current?.(id)
                      },
                      onRotate: (id, rotation) => {
                        console.log('[useViewerInit] Edit2D marker rotated:', id, rotation)
                        onPlacementRotateRef.current?.(id, rotation)
                      },
                      onMove: (id, pageX, pageY) => {
                        console.log('[useViewerInit] Edit2D marker moved:', id, pageX, pageY)
                        // Convert page coords to DWG coords for storage
                        const dwg = pageToDwgCoords(pageX, pageY)
                        // TODO: Add onPlacementMove callback to persist position changes
                        console.log('[useViewerInit] New DWG coords:', dwg.x.toFixed(2), dwg.y.toFixed(2))
                      },
                    })

                    // Activate polygonEditTool to enable selection/manipulation of Edit2D shapes
                    // Without an active Edit2D tool, clicks go to DWG viewer instead
                    const polygonEditToolName = edit2d.defaultTools?.polygonEditTool?.getName?.()
                    if (polygonEditToolName) {
                      viewer.toolController.activateTool(polygonEditToolName)
                      console.log('[useViewerInit] Activated Edit2D polygonEditTool for selection')
                    }

                    console.log('[useViewerInit] Edit2DMarkers initialized with callbacks')
                  } else {
                    console.warn('[useViewerInit] Edit2DMarkers failed to initialize')
                  }
                }
              } catch (edit2dError) {
                // Edit2D is optional for now - MarkupsCore will continue to work
                console.warn('[useViewerInit] Edit2D extension failed to load:', edit2dError)
              }
              // ============================================================================

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
                        console.warn('[useViewerInit] World coords failed, using screen coords')
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
                      console.log('[useViewerInit] Placed marker:', {
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
                      console.warn('[useViewerInit] markerData is null - marker not placed')
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
                console.log('[useViewerInit] Rendering', initialPlacementsRef.current.length, 'initial placements')
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
                      fossPid: placement.fossPid,  // FOSS product ID for SVG symbol lookup
                      symbol: placement.symbol,  // Symbol label from database
                    },
                    placement.id,
                    placement.rotation  // Initial rotation from database
                  )
                  renderedPlacementIdsRef.current.add(placement.id)
                }
                console.log('[useViewerInit] Initial placements rendered')
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
  }, [
    containerRef,
    viewerRef,
    placementToolRef,
    markupMarkersRef,
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
    setIsLoading,
    setLoadingStage,
    setDwgUnitString,
    setDwgCoordinates,
    setHasSelectedMarker,
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
          // Dispose MarkupMarkers to remove event listeners
          markupMarkersRef.current?.dispose()
          markupMarkersRef.current = null

          // Dispose Edit2DMarkers (Phase 4B)
          edit2dMarkersRef.current?.dispose()
          edit2dMarkersRef.current = null

          // Clear Edit2D context (Phase 4B)
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
      renderedPlacementIdsRef.current.clear() // Reset rendered placements tracking
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
    console.log('[useViewerInit] FitAll - Calling setViewFromFile()...')
    viewer.setViewFromFile()
  }, [viewerRef])

  return {
    isInitialized: isInitializedRef.current,
    handleFitAll,
  }
}
