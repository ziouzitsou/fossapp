/**
 * MarkerSelectionController - Handles selection and hover functionality
 *
 * Extracted from Edit2DMarkers to reduce file size and improve modularity.
 * This controller manages:
 * - Selection change events from Edit2D
 * - Hover state and label scaling
 * - Style modifiers for visual feedback
 * - Move detection when selection changes
 */

import type {
  Edit2DContext,
  Edit2DShape,
} from '@/types/autodesk-viewer'

import type { Edit2DMarkerCallbacks } from './types'
import { STYLE_CONSTANTS } from './style-manager'
import type { ShapeLabel } from './label-utils'

/**
 * Interface for the parent marker manager
 */
export interface MarkerSelectionParent {
  getContext(): Edit2DContext | null
  getMarkerShapes(id: string): Edit2DShape[] | undefined
  getLabel(id: string): ShapeLabel | undefined
  getAllLabels(): Map<string, ShapeLabel>
  getCallbacks(): Edit2DMarkerCallbacks
  getShapeToMarkerMap(): Map<number, string>
  getSelectedId(): string | null
  setSelectedId(id: string | null): void
  getMarkerPagePosition(id: string): { pageX: number; pageY: number } | null
  updateMarkerPagePosition(id: string, pageX: number, pageY: number): void
}

/**
 * Controller for marker selection and hover operations
 */
export class MarkerSelectionController {
  private parent: MarkerSelectionParent

  // Flag to prevent recursive selection changes
  private isSelectingSiblings = false

  // Track currently hovered marker ID for label styling
  private hoveredMarkerId: string | null = null

  constructor(parent: MarkerSelectionParent) {
    this.parent = parent
  }

  /**
   * Set up Edit2D selection event listeners
   */
  setupSelectionListeners(): void {
    const ctx = this.parent.getContext()
    if (!ctx?.selection) return

    const selectionEvents = window.Autodesk?.Edit2D?.Selection?.Events
    if (selectionEvents) {
      ctx.selection.addEventListener(
        selectionEvents.SELECTION_CHANGED,
        this.handleSelectionChanged.bind(this)
      )

      ctx.selection.addEventListener(
        selectionEvents.SELECTION_HOVER_CHANGED,
        this.handleHoverChanged.bind(this)
      )
    }
  }

  /**
   * Set up style modifier for hover and selection visual feedback
   */
  setupHoverStyleModifier(): void {
    const ctx = this.parent.getContext()
    if (!ctx?.layer) return

    const shapeToMarker = this.parent.getShapeToMarkerMap()

    ctx.layer.addStyleModifier((shape, style) => {
      // Only apply to our marker shapes
      if (!shapeToMarker.has(shape.id)) {
        return undefined
      }

      const markerId = shapeToMarker.get(shape.id)
      const markerShapes = markerId ? this.parent.getMarkerShapes(markerId) : null

      // Check if this marker is selected
      const isSelected = markerId === this.parent.getSelectedId()

      // Read hovered ID directly from selection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentHoveredId = (ctx?.selection as any)?.hoveredId ?? null
      const isHovered = markerShapes?.some(s => s.id === currentHoveredId) ?? false

      // Selection takes precedence over hover
      if (isSelected) {
        const modified = style.clone()
        modified.lineColor = STYLE_CONSTANTS.SELECTED.lineColor
        modified.lineWidth = STYLE_CONSTANTS.SELECTED.lineWidth
        return modified
      }

      if (isHovered) {
        const modified = style.clone()
        modified.lineColor = STYLE_CONSTANTS.HOVER.lineColor
        modified.lineWidth = STYLE_CONSTANTS.HOVER.lineWidth
        return modified
      }

      return undefined
    })
  }

  /**
   * Handle hover from mouse move (detected via hit testing)
   */
  handleMouseHover(hitShapeId: number | null): void {
    const shapeToMarker = this.parent.getShapeToMarkerMap()
    const newHoveredMarkerId = hitShapeId !== null ? shapeToMarker.get(hitShapeId) ?? null : null

    if (newHoveredMarkerId !== this.hoveredMarkerId) {
      this.updateLabelHoverState(this.hoveredMarkerId, newHoveredMarkerId)
      this.hoveredMarkerId = newHoveredMarkerId
    }
  }

  /**
   * Get current hovered marker ID
   */
  getHoveredMarkerId(): string | null {
    return this.hoveredMarkerId
  }

  /**
   * Clear selection state
   */
  clearSelection(): void {
    const ctx = this.parent.getContext()
    if (ctx?.selection) {
      ctx.selection.clear()
    }
    this.parent.setSelectedId(null)
  }

  /**
   * Select a marker by ID
   */
  selectMarker(id: string | null): void {
    const ctx = this.parent.getContext()
    if (!ctx?.selection) return

    if (id === null) {
      ctx.selection.clear()
      this.parent.setSelectedId(null)
      this.parent.getCallbacks().onSelect?.(null)
      ctx.layer.update()
      return
    }

    const shapes = this.parent.getMarkerShapes(id)
    if (shapes && shapes.length > 0) {
      ctx.selection.selectOnly(shapes[0])
      this.parent.setSelectedId(id)
      this.parent.getCallbacks().onSelect?.(id)
      ctx.layer.update()
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update label hover state - scale up/down label text elements
   */
  private updateLabelHoverState(prevMarkerId: string | null, newMarkerId: string | null): void {
    // Remove scale from previous label
    if (prevMarkerId) {
      const prevLabel = this.parent.getLabel(prevMarkerId)
      if (prevLabel?.textDiv) {
        prevLabel.textDiv.style.transition = 'transform 0.2s ease-out'
        prevLabel.textDiv.style.transform = 'scale(1)'
        prevLabel.textDiv.style.zIndex = ''
      }
    }

    // Apply scale to new label
    if (newMarkerId) {
      const newLabel = this.parent.getLabel(newMarkerId)
      if (newLabel?.textDiv) {
        newLabel.textDiv.style.transition = 'transform 0.2s ease-out'
        newLabel.textDiv.style.transformOrigin = 'center center'
        newLabel.textDiv.style.transform = 'scale(1.5)'
        newLabel.textDiv.style.zIndex = '1000'
      }
    }
  }

  /**
   * Handle hover change events from Edit2D selection
   */
  private handleHoverChanged(): void {
    this.parent.getContext()?.layer?.update?.()
  }

  /**
   * Handle Edit2D selection change events
   */
  private handleSelectionChanged(): void {
    const ctx = this.parent.getContext()
    if (!ctx?.selection) return

    // Prevent recursion when we programmatically clear selection
    if (this.isSelectingSiblings) return

    // Before updating selection, check if the previously selected marker moved
    const selectedId = this.parent.getSelectedId()
    if (selectedId) {
      this.checkForMoveAndUpdate(selectedId)
    }

    const selectedShapes = ctx.selection.getSelectedShapes()

    if (selectedShapes.length === 0) {
      if (selectedId) {
        this.parent.setSelectedId(null)
        this.parent.getCallbacks().onSelect?.(null)
        ctx.layer.update()
      }
      return
    }

    // Find the marker ID using the reverse lookup
    const selectedShape = selectedShapes[0]
    const shapeToMarker = this.parent.getShapeToMarkerMap()
    const markerId = shapeToMarker.get(selectedShape.id)

    if (!markerId) {
      this.isSelectingSiblings = true
      ctx.selection.clear()
      this.isSelectingSiblings = false
      return
    }

    // Update our internal selection state
    if (selectedId !== markerId) {
      this.parent.setSelectedId(markerId)
      this.parent.getCallbacks().onSelect?.(markerId)
    }

    // Clear Edit2D selection to hide the gizmo
    this.isSelectingSiblings = true
    ctx.selection.clear()
    this.isSelectingSiblings = false

    ctx.layer.update()
  }

  /**
   * Check if a marker's shapes have moved and update stored coordinates
   */
  private checkForMoveAndUpdate(markerId: string): void {
    const pos = this.parent.getMarkerPagePosition(markerId)
    const shapes = this.parent.getMarkerShapes(markerId)

    if (!pos || !shapes || shapes.length === 0) return

    const firstShape = shapes[0]
    const bbox = firstShape.getBBox?.()
    if (!bbox) return

    const newX = (bbox.min.x + bbox.max.x) / 2
    const newY = (bbox.min.y + bbox.max.y) / 2

    const dx = Math.abs(newX - pos.pageX)
    const dy = Math.abs(newY - pos.pageY)
    const moveThreshold = 0.1

    if (dx > moveThreshold || dy > moveThreshold) {
      this.parent.updateMarkerPagePosition(markerId, newX, newY)
      this.parent.getCallbacks().onMove?.(markerId, newX, newY)
    }
  }

  /**
   * Dispose controller resources
   */
  dispose(): void {
    this.hoveredMarkerId = null
    this.isSelectingSiblings = false
  }
}
