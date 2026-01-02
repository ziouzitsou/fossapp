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

import { useEffect, useState, type RefObject } from 'react'
import type { Viewer3DInstance } from '@/types/autodesk-viewer'
import type { WorldCoordinates, PlacementModeProduct } from '../types'
import type { DwgCoordinates } from '../placement-tool'

interface UseViewerEventsOptions {
  containerRef: RefObject<HTMLDivElement | null>
  viewerRef: RefObject<Viewer3DInstance | null>
  isLoading: boolean
  /** Current placement mode (affects coordinate tracking) */
  placementMode?: PlacementModeProduct | null
  /** Coordinate conversion function (page to DWG) */
  pageToDwgCoords: (pageX: number, pageY: number) => { x: number; y: number }
  /** Callback when viewer is clicked (for external placement handling) */
  onViewerClick?: (worldCoords: WorldCoordinates | null, screenCoords: { x: number; y: number }) => void
  /** Callback to exit placement mode */
  onExitPlacementMode?: () => void
}

interface UseViewerEventsReturn {
  /** Current DWG coordinates under mouse cursor */
  dwgCoordinates: DwgCoordinates | null
  /** Set DWG coordinates (for PlacementTool to update) */
  setDwgCoordinates: (coords: DwgCoordinates | null) => void
}

export function useViewerEvents({
  containerRef,
  viewerRef,
  isLoading,
  placementMode,
  pageToDwgCoords,
  onViewerClick,
  onExitPlacementMode,
}: UseViewerEventsOptions): UseViewerEventsReturn {
  const [dwgCoordinates, setDwgCoordinates] = useState<DwgCoordinates | null>(null)

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
  }, [containerRef, viewerRef, isLoading, placementMode, pageToDwgCoords])

  /**
   * ESC key to exit placement mode
   */
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

  return {
    dwgCoordinates,
    setDwgCoordinates,
  }
}
