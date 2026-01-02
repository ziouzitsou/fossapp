'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ViewerTool, ViewerCoordinates, PlacementMode, LuminaireProduct } from '../types'

/**
 * Viewer controls hook - manages pan, zoom, and placement interactions
 *
 * Separates viewer-specific state from the main state hook to keep
 * concerns isolated. This makes the viewer easier to test and modify.
 */
export function useViewerControls() {
  // ============================================================================
  // TOOL STATE
  // ============================================================================

  const [viewerTool, setViewerTool] = useState<ViewerTool>('select')
  const [placementMode, setPlacementMode] = useState<PlacementMode | null>(null)

  // ============================================================================
  // MOUSE TRACKING
  // ============================================================================

  const [mousePosition, setMousePosition] = useState<ViewerCoordinates>({ x: 0, y: 0 })
  const viewerRef = useRef<HTMLDivElement>(null)

  /**
   * Handle mouse move on the viewer canvas
   * Converts screen coordinates to DWG model space coordinates
   */
  const handleViewerMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()

    // TODO: In Phase 4, this will use real DWG coordinate transformation
    // For now, simulate CAD coordinates (scaled by 10 for demo)
    // Origin is bottom-left in CAD, so we flip Y
    const scaleToModel = 10 // Placeholder scale factor
    setMousePosition({
      x: Math.round((e.clientX - rect.left) * scaleToModel),
      y: Math.round((rect.height - (e.clientY - rect.top)) * scaleToModel),
    })
  }, [])

  // ============================================================================
  // PLACEMENT MODE
  // ============================================================================

  /** Start placing a product */
  const startPlacement = useCallback((product: LuminaireProduct) => {
    setPlacementMode({
      productId: product.id,
      symbol: product.symbol,
      productName: product.name,
    })
    setViewerTool('select') // Reset to select for placement
  }, [])

  /** Cancel current placement */
  const cancelPlacement = useCallback(() => {
    setPlacementMode(null)
  }, [])

  /** Check if a specific product is being placed */
  const isPlacing = useCallback(
    (productId: string): boolean => {
      return placementMode?.productId === productId
    },
    [placementMode]
  )

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if viewer is focused or we're in placement mode
      if (!placementMode && !viewerRef.current?.contains(document.activeElement)) {
        return
      }

      switch (e.key) {
        case 'Escape':
          if (placementMode) {
            cancelPlacement()
            e.preventDefault()
          }
          break
        case 'r':
        case 'R':
          // TODO: Rotate placement preview (Phase 4)
          break
        case ' ':
          // Toggle pan mode while holding space
          if (!placementMode) {
            setViewerTool('pan')
            e.preventDefault()
          }
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && !placementMode) {
        setViewerTool('select')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [placementMode, cancelPlacement])

  // ============================================================================
  // ZOOM & PAN (stubs for Phase 4)
  // ============================================================================

  const zoomIn = useCallback(() => {
    // TODO: Implement in Phase 4 with real viewer
    console.log('Zoom in')
  }, [])

  const zoomOut = useCallback(() => {
    // TODO: Implement in Phase 4 with real viewer
    console.log('Zoom out')
  }, [])

  const zoomFit = useCallback(() => {
    // TODO: Implement in Phase 4 with real viewer
    console.log('Zoom fit')
  }, [])

  const resetView = useCallback(() => {
    // TODO: Implement in Phase 4 with real viewer
    console.log('Reset view')
  }, [])

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    // Refs
    viewerRef,

    // Tool state
    viewerTool,
    setViewerTool,

    // Placement mode
    placementMode,
    startPlacement,
    cancelPlacement,
    isPlacing,

    // Mouse tracking
    mousePosition,
    handleViewerMouseMove,

    // Zoom & pan
    zoomIn,
    zoomOut,
    zoomFit,
    resetView,
  }
}

/** Return type of the hook for component props */
export type ViewerControlsValue = ReturnType<typeof useViewerControls>
