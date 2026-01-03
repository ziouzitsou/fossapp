/**
 * useCoordinateTransform Hook
 *
 * Handles coordinate transformation between APS Viewer page coordinates
 * and DWG model space coordinates.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COORDINATE TRANSFORMATION (2D DWGs)
 * ═══════════════════════════════════════════════════════════════════════════
 * APS Viewer uses 2-stage coordinates for 2D DWGs:
 *   Screen (pixels) → Page (viewer internal) → DWG Model Space
 *
 * - PlacementTool outputs PAGE coordinates (from visible bounds or snapper)
 * - We convert Page→DWG for storage/export (LISP scripts need DWG coords)
 * - We convert DWG→Page for marker rendering (markers positioned in page space)
 *
 * Transform source: model.getPageToModelTransform(1) - viewport 1 = model space
 * See: https://aps.autodesk.com/blog/parsing-line-points-viewer
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useRef, useCallback, type RefObject } from 'react'
import type { Viewer3DInstance } from '@/types/autodesk-viewer'
import type { PageToModelTransform } from '../types'

interface UseCoordinateTransformOptions {
  viewerRef: RefObject<Viewer3DInstance | null>
}

interface UseCoordinateTransformReturn {
  /**
   * Convert page coordinates (from APS viewer) to DWG model space coordinates.
   * Uses matrix elements from getPageToModelTransform(vpId=1).
   * Lazily extracts transform on first use (not available during geometry load).
   */
  pageToDwgCoords: (pageX: number, pageY: number) => { x: number; y: number }

  /**
   * Convert DWG model space coordinates to page coordinates (for marker positioning).
   * Inverse of pageToDwgCoords: pageX = (dwgX - translateX) / scaleX
   */
  dwgToPageCoords: (dwgX: number, dwgY: number) => { x: number; y: number }

  /**
   * Reset the cached transform (call when loading a new model)
   */
  resetTransform: () => void

  /**
   * Directly set the transform values (call when transform is available).
   * Use this to fix timing issues where lazy extraction gets identity matrix.
   */
  setTransform: (scaleX: number, scaleY: number, translateX: number, translateY: number) => void

  /**
   * Reference to the transform for external access if needed
   */
  transformRef: RefObject<PageToModelTransform | null>
}

export function useCoordinateTransform({
  viewerRef,
}: UseCoordinateTransformOptions): UseCoordinateTransformReturn {
  // Page-to-Model transformation stored as plain numbers for reliable access
  // Format: [scaleX, scaleY, translateX, translateY] from Matrix4 column-major layout
  // Lazily extracted on first use (not available during GEOMETRY_LOADED event)
  const pageToModelTransformRef = useRef<PageToModelTransform | null>(null)

  /**
   * Lazily extract the page-to-model transform from the viewer's model
   */
  const extractTransform = useCallback((): PageToModelTransform | null => {
    if (pageToModelTransformRef.current) {
      return pageToModelTransformRef.current
    }

    if (!viewerRef.current?.model) {
      return null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = viewerRef.current.model as any
    const matrix = model.getPageToModelTransform?.(1)

    if (matrix?.elements) {
      const e = matrix.elements
      // Extract [scaleX, scaleY, translateX, translateY] from Matrix4 (column-major)
      pageToModelTransformRef.current = [e[0], e[5], e[12], e[13]]
      console.log('[useCoordinateTransform] Lazy-loaded page-to-model transform:', pageToModelTransformRef.current)
    }

    return pageToModelTransformRef.current
  }, [viewerRef])

  /**
   * Convert page coordinates (from APS viewer) to DWG model space coordinates.
   */
  const pageToDwgCoords = useCallback((pageX: number, pageY: number): { x: number; y: number } => {
    const transform = extractTransform()

    if (!transform) {
      return { x: pageX, y: pageY }
    }

    const [scaleX, scaleY, translateX, translateY] = transform

    // Apply affine transformation: result = scale * input + translate
    const dwgX = scaleX * pageX + translateX
    const dwgY = scaleY * pageY + translateY

    return { x: dwgX, y: dwgY }
  }, [extractTransform])

  /**
   * Convert DWG model space coordinates to page coordinates (for marker positioning).
   * Inverse of pageToDwgCoords: pageX = (dwgX - translateX) / scaleX
   */
  const dwgToPageCoords = useCallback((dwgX: number, dwgY: number): { x: number; y: number } => {
    const transform = extractTransform()

    if (!transform) {
      return { x: dwgX, y: dwgY }
    }

    const [scaleX, scaleY, translateX, translateY] = transform

    // Inverse affine: pageX = (dwgX - translateX) / scaleX
    const pageX = (dwgX - translateX) / scaleX
    const pageY = (dwgY - translateY) / scaleY

    return { x: pageX, y: pageY }
  }, [extractTransform])

  /**
   * Reset the cached transform (call when loading a new model)
   */
  const resetTransform = useCallback(() => {
    pageToModelTransformRef.current = null
  }, [])

  /**
   * Directly set the transform values.
   * Use this when the correct transform is extracted after viewer initialization,
   * to fix timing issues where lazy extraction got identity matrix.
   */
  const setTransform = useCallback((
    scaleX: number,
    scaleY: number,
    translateX: number,
    translateY: number
  ) => {
    pageToModelTransformRef.current = [scaleX, scaleY, translateX, translateY]
    console.log('[useCoordinateTransform] Transform set directly:', pageToModelTransformRef.current)
  }, [])

  return {
    pageToDwgCoords,
    dwgToPageCoords,
    resetTransform,
    setTransform,
    transformRef: pageToModelTransformRef,
  }
}
