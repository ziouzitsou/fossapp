/**
 * MarkerMoveController - Handles marker move mode functionality
 *
 * Extracted from Edit2DMarkers to reduce file size and improve modularity.
 * This controller manages:
 * - Starting/canceling move mode
 * - Move preview rendering
 * - Move confirmation and position updates
 */

import type {
  Edit2DContext,
  Edit2DShape,
} from '@/types/autodesk-viewer'

import type { Edit2DMarkerData, Edit2DMarkerCallbacks, UnitScales } from './types'
import { SvgFetcher } from './svg-fetcher'
import { createShapesFromSvg, createFallbackCircleShape } from './shape-factory'

/**
 * Interface for the parent marker manager that this controller needs access to
 */
export interface MarkerMoveParent {
  getContext(): Edit2DContext | null
  getMarkerData(id: string): Edit2DMarkerData | undefined
  getMarkerShapes(id: string): Edit2DShape[] | undefined
  getLabel(id: string): { setVisible: (visible: boolean) => void } | undefined
  getUnitScales(): UnitScales
  getCallbacks(): Edit2DMarkerCallbacks
  getSvgFetcher(): SvgFetcher
  updateMarkerShapes(id: string, shapes: Edit2DShape[]): void
  updateMarkerPosition(id: string, pageX: number, pageY: number): void
  addLabelToShape(markerId: string, shape: Edit2DShape, text: string): void
  removeLabel(id: string): void
  clearSelection(): void
}

/**
 * Controller for marker move mode operations
 */
export class MarkerMoveController {
  private parent: MarkerMoveParent

  // Move mode state
  private movingMarkerId: string | null = null
  private movePreviewShapes: Edit2DShape[] = []
  private movePreviewThrottleMs = 50
  private lastMovePreviewTime = 0

  constructor(parent: MarkerMoveParent) {
    this.parent = parent
  }

  /**
   * Check if currently in move mode
   */
  isMoving(): boolean {
    return this.movingMarkerId !== null
  }

  /**
   * Get the ID of the marker being moved
   */
  getMovingMarkerId(): string | null {
    return this.movingMarkerId
  }

  /**
   * Start move mode for a marker
   * Clears Edit2D selection (hides gizmo), ghosts the original shapes,
   * and notifies parent to activate snapping/crosshair cursor.
   */
  startMove(id: string): void {
    const ctx = this.parent.getContext()
    if (!ctx) return

    const data = this.parent.getMarkerData(id)
    const shapes = this.parent.getMarkerShapes(id)
    if (!data || !shapes) return

    this.movingMarkerId = id

    // Clear Edit2D selection to hide the move gizmo
    ctx.selection.clear()

    // Ghost the original shapes (reduce opacity)
    for (const shape of shapes) {
      if (shape.style) {
        shape.style.lineAlpha = 0.3
        shape.style.fillAlpha = 0.3
      }
    }

    // Hide label during move
    const label = this.parent.getLabel(id)
    if (label) {
      label.setVisible(false)
    }

    ctx.layer.update()

    // Notify parent to activate snapping/crosshair cursor
    this.parent.getCallbacks().onMoveStart?.(id)
  }

  /**
   * Cancel move mode - restore original shapes and re-select marker
   */
  cancelMove(): void {
    if (!this.movingMarkerId) return

    const ctx = this.parent.getContext()
    if (!ctx) return

    const shapes = this.parent.getMarkerShapes(this.movingMarkerId)

    // Restore original shapes opacity
    if (shapes) {
      for (const shape of shapes) {
        if (shape.style) {
          shape.style.lineAlpha = 1
          shape.style.fillAlpha = 1
        }
      }
    }

    // Show label again
    const label = this.parent.getLabel(this.movingMarkerId)
    if (label) {
      label.setVisible(true)
    }

    // Remove preview shapes
    for (const shape of this.movePreviewShapes) {
      ctx.removeShape(shape)
    }
    this.movePreviewShapes = []

    // Re-select the marker in Edit2D so selection style is applied
    if (shapes?.[0]) {
      ctx.selection.selectOnly(shapes[0])
    }

    ctx.layer.update()

    this.movingMarkerId = null
    this.parent.getCallbacks().onMoveEnd?.()
  }

  /**
   * Update move preview at the given page coordinates
   * Called during mouse move when in move mode
   */
  async updateMovePreview(pageX: number, pageY: number): Promise<void> {
    if (!this.movingMarkerId) return

    const ctx = this.parent.getContext()
    if (!ctx) return

    // Throttle preview updates
    const now = Date.now()
    if (now - this.lastMovePreviewTime < this.movePreviewThrottleMs) return
    this.lastMovePreviewTime = now

    const data = this.parent.getMarkerData(this.movingMarkerId)
    if (!data) return

    // Remove old preview shapes
    for (const shape of this.movePreviewShapes) {
      ctx.removeShape(shape)
    }

    // Create new preview shapes at target position
    const fossPid = data.fossPid || data.productName
    const unitScales = this.parent.getUnitScales()
    let newShapes: Edit2DShape[] | null = null

    if (fossPid) {
      const svgContent = await this.parent.getSvgFetcher().fetchSymbolSvg(fossPid)
      if (svgContent) {
        newShapes = createShapesFromSvg(svgContent, pageX, pageY, data.rotation, unitScales)
      }
    }

    // Fall back to circle if no SVG
    if (!newShapes) {
      newShapes = createFallbackCircleShape(pageX, pageY, unitScales)
    }

    if (!newShapes || newShapes.length === 0) return

    // Apply preview style (semi-transparent cyan)
    for (const shape of newShapes) {
      if (shape.style) {
        shape.style.lineColor = '#00ffff'
        shape.style.lineAlpha = 0.6
        shape.style.fillAlpha = 0.2
        shape.style.lineWidth = 1
      }
      ctx.addShape(shape)
    }

    this.movePreviewShapes = newShapes
    ctx.layer.update()
  }

  /**
   * Confirm move - place marker at new position
   * Called on click when in move mode
   */
  async confirmMove(pageX: number, pageY: number): Promise<void> {
    if (!this.movingMarkerId) return

    const ctx = this.parent.getContext()
    if (!ctx) {
      this.cancelMove()
      return
    }

    const id = this.movingMarkerId
    const data = this.parent.getMarkerData(id)
    const oldShapes = this.parent.getMarkerShapes(id)

    if (!data || !oldShapes) {
      this.cancelMove()
      return
    }

    // Remove preview shapes
    for (const shape of this.movePreviewShapes) {
      ctx.removeShape(shape)
    }
    this.movePreviewShapes = []

    // Remove old shapes from layer
    for (const shape of oldShapes) {
      ctx.removeShape(shape)
    }

    // Remove old label
    this.parent.removeLabel(id)

    // Create new shapes at target position (preserve rotation)
    const fossPid = data.fossPid || data.productName
    const unitScales = this.parent.getUnitScales()
    let newShapes: Edit2DShape[] | null = null

    if (fossPid) {
      const svgContent = await this.parent.getSvgFetcher().fetchSymbolSvg(fossPid)
      if (svgContent) {
        newShapes = createShapesFromSvg(svgContent, pageX, pageY, data.rotation, unitScales)
      }
    }

    // Fall back to circle if no SVG
    if (!newShapes) {
      newShapes = createFallbackCircleShape(pageX, pageY, unitScales)
    }

    if (!newShapes || newShapes.length === 0) {
      console.error(`[MarkerMoveController] Failed to create shapes for move: ${id}`)
      this.cancelMove()
      return
    }

    // Add new shapes to layer
    for (const shape of newShapes) {
      ctx.addShape(shape)
    }

    // Update parent's shape tracking
    this.parent.updateMarkerShapes(id, newShapes)

    // Update marker position
    this.parent.updateMarkerPosition(id, pageX, pageY)

    // Re-add label
    if (data.symbol && newShapes[0]) {
      this.parent.addLabelToShape(id, newShapes[0], data.symbol)
    }

    // Clear selection after move (same behavior as after placement)
    this.parent.clearSelection()

    ctx.layer.update()

    this.movingMarkerId = null
    this.parent.getCallbacks().onMoveEnd?.()

    // Notify parent of position change
    this.parent.getCallbacks().onMove?.(id, pageX, pageY)
  }

  /**
   * Cleanup on dispose
   */
  dispose(): void {
    this.movePreviewShapes = []
    this.movingMarkerId = null
  }
}
