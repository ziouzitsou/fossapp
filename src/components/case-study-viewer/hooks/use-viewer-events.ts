/**
 * useViewerEvents Hook
 *
 * Manages viewer DOM events and keyboard handlers:
 * - Click events for placing products
 * - Resize events (window and container)
 * - Wheel events (prevent scroll propagation)
 * - Mouse tracking for coordinate display
 * - ESC key to exit placement mode
 */

import { useEffect, useState, useCallback, type RefObject } from 'react'
import type { Viewer3DInstance, ViewerModel } from '@/types/autodesk-viewer'
import type { WorldCoordinates, PlacementModeProduct } from '../types'
import type { DwgCoordinates } from '../placement-tool'

interface UseViewerEventsOptions {
  containerRef: RefObject<HTMLDivElement | null>
  viewerRef: RefObject<Viewer3DInstance | null>
  isLoading: boolean
  /** Current placement mode (affects coordinate tracking) */
  placementMode?: PlacementModeProduct | null
  /** Whether measure mode is active */
  isMeasuring?: boolean
  /** Whether a marker is selected */
  hasSelectedMarker?: boolean
  /** Coordinate conversion function (page to DWG) */
  pageToDwgCoords: (pageX: number, pageY: number) => { x: number; y: number }
  /** Callback when viewer is clicked (for external placement handling) */
  onViewerClick?: (worldCoords: WorldCoordinates | null, screenCoords: { x: number; y: number }) => void
  /** Callback to exit placement mode */
  onExitPlacementMode?: () => void
  /** Callback to exit measure mode */
  onExitMeasureMode?: () => void
  /** Callback to deselect marker */
  onDeselectMarker?: () => void
}

/** Info about the clicked/selected entity (for debugging) */
export interface SelectedEntityInfo {
  dbId: number
  name: string
  type?: string
  layer?: string
}

interface UseViewerEventsReturn {
  /** Current DWG coordinates under mouse cursor */
  dwgCoordinates: DwgCoordinates | null
  /** Set DWG coordinates (for PlacementTool to update) */
  setDwgCoordinates: (coords: DwgCoordinates | null) => void
  /** Currently selected entity info (for debugging) */
  selectedEntityInfo: SelectedEntityInfo | null
  /** Clear the selected entity info */
  clearSelectedEntity: () => void
}

export function useViewerEvents({
  containerRef,
  viewerRef,
  isLoading,
  placementMode,
  isMeasuring,
  hasSelectedMarker,
  pageToDwgCoords,
  onViewerClick,
  onExitPlacementMode,
  onExitMeasureMode,
  onDeselectMarker,
}: UseViewerEventsOptions): UseViewerEventsReturn {
  const [dwgCoordinates, setDwgCoordinates] = useState<DwgCoordinates | null>(null)
  const [selectedEntityInfo, setSelectedEntityInfo] = useState<SelectedEntityInfo | null>(null)

  const clearSelectedEntity = useCallback(() => {
    setSelectedEntityInfo(null)
  }, [])

  /**
   * Handle click events for placing products
   */
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
  }, [containerRef, viewerRef, onViewerClick])

  /**
   * Handle resize (window and container)
   */
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
  }, [containerRef, viewerRef])

  /**
   * Prevent wheel events from propagating
   */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const preventScroll = (e: WheelEvent) => {
      e.stopPropagation()
    }

    container.addEventListener('wheel', preventScroll, { passive: false })
    return () => container.removeEventListener('wheel', preventScroll)
  }, [containerRef])

  /**
   * Track mouse position for coordinate display (when not in placement mode)
   * In placement mode, PlacementTool handles this with snapping
   */
  useEffect(() => {
    const container = containerRef.current
    const viewer = viewerRef.current
    if (!container || !viewer || isLoading) return

    // Skip if placement mode is active (PlacementTool handles coordinates with snapping)
    if (placementMode) return

    const handleMouseMove = (e: MouseEvent) => {
      // Get canvas-relative coordinates
      const rect = container.getBoundingClientRect()
      const clientX = e.clientX - rect.left
      const clientY = e.clientY - rect.top

      // Use clientToWorld to get display coordinates (consistent with calibration)
      const worldResult = viewer.clientToWorld(clientX, clientY)
      if (worldResult?.point) {
        const dwg = pageToDwgCoords(worldResult.point.x, worldResult.point.y)
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
  }, [containerRef, viewerRef, isLoading, placementMode, pageToDwgCoords])

  /**
   * Track entity selection for debugging
   * Shows entity info when user clicks on a DWG entity
   */
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || isLoading) return

    const handleSelectionChanged = (event: unknown) => {
      const selectionEvent = event as { dbIdArray?: number[] }
      const dbIds = selectionEvent.dbIdArray || []

      if (dbIds.length === 0) {
        setSelectedEntityInfo(null)
        return
      }

      // Get info for the first selected entity
      const dbId = dbIds[0]

      // Use global NOP_VIEWER which has proper property database access
      const globalViewer = (window as unknown as { NOP_VIEWER?: { model?: ViewerModel } }).NOP_VIEWER
      const model = globalViewer?.model

      if (model?.getProperties) {
        model.getProperties(dbId, (props) => {
          if (props) {
            const type = props.properties?.find(p => p.displayName === 'type')?.displayValue as string | undefined
            const layer = props.properties?.find(p => p.displayName === 'Layer')?.displayValue as string | undefined
            setSelectedEntityInfo({ dbId, name: props.name, type, layer })
          } else {
            setSelectedEntityInfo({ dbId, name: `Entity ${dbId}` })
          }
        }, () => {
          // Error callback - just show dbId
          setSelectedEntityInfo({ dbId, name: `Entity ${dbId}` })
        })
      } else {
        // No property access - just show dbId
        setSelectedEntityInfo({ dbId, name: `Entity ${dbId}` })
      }
    }

    // Autodesk.Viewing.SELECTION_CHANGED_EVENT
    viewer.addEventListener('selection', handleSelectionChanged)
    return () => {
      viewer.removeEventListener('selection', handleSelectionChanged)
    }
  }, [viewerRef, isLoading])

  /**
   * ESC key to exit to IDLE mode
   * Always clears placement mode and selection
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'Escape') {
        // ESC: Exit everything, go to IDLE
        onExitPlacementMode?.()
        onExitMeasureMode?.()
        onDeselectMarker?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onExitPlacementMode, onExitMeasureMode, onDeselectMarker])

  return {
    dwgCoordinates,
    setDwgCoordinates,
    selectedEntityInfo,
    clearSelectedEntity,
  }
}
