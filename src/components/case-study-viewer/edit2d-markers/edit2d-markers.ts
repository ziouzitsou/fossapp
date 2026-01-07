/**
 * Edit2DMarkers - Product placement using Edit2D managed shapes
 *
 * Phase 4B migration from MarkupsCore to Edit2D extension.
 *
 * Key advantages over MarkupsCore:
 * - Shapes are tracked by Edit2D (no phantom clicks)
 * - Built-in selection, move, rotate gizmos
 * - Undo/redo support via ctx.undoStack
 * - Proper hit-testing (removeShape actually removes interaction)
 *
 * Coordinate system:
 * - Edit2D uses the same page coordinate system as MarkupsCore
 * - Conversion to/from DWG model coords uses getPageToModelTransform()
 */

import type {
  Edit2DContext,
  Edit2DShape,
  Edit2DExtension,
  Viewer3DInstance,
} from '@/types/autodesk-viewer'

import {
  type Edit2DMarkerData,
  type Edit2DMarkerCallbacks,
  type UnitScales,
} from './types'
import { injectHoverStyles } from './css-styles'
import { SvgFetcher } from './svg-fetcher'
import { createShapesFromSvg, createFallbackCircleShape } from './shape-factory'
import {
  type ShapeLabel,
  applyLabelStyle,
  calculateMinFontSize,
  createShapeLabel,
} from './label-utils'

/**
 * Edit2DMarkers - Manages luminaire markers using Edit2D extension
 *
 * @remarks
 * This class provides the same functionality as MarkupMarkers but uses
 * Edit2D's managed shape system for proper selection, visibility, and
 * manipulation support.
 */
export class Edit2DMarkers {
  private viewer: Viewer3DInstance
  private edit2d: Edit2DExtension | null = null
  private ctx: Edit2DContext | null = null

  // Shape tracking: marker ID -> array of Edit2D shapes (SVG markers have multiple shapes)
  private shapes: Map<string, Edit2DShape[]> = new Map()
  // Reverse lookup: shape ID -> marker ID (for selection handling)
  private shapeToMarker: Map<number, string> = new Map()
  // Marker data: marker ID -> marker data
  private markerData: Map<string, Edit2DMarkerData> = new Map()
  // Label tracking: marker ID -> label shape (for cleanup)
  private labels: Map<string, ShapeLabel> = new Map()

  // Selection state
  private selectedId: string | null = null

  // Callbacks
  private callbacks: Edit2DMarkerCallbacks = {}

  // SVG symbol fetcher (with caching)
  private svgFetcher = new SvgFetcher()

  // Hidden symbol groups (by full symbol, e.g., "A1", "B2")
  private hiddenGroups: Set<string> = new Set()

  // Unit scaling factors (set after model loads)
  private unitScales: UnitScales = {
    modelUnitScale: 1,      // meters=1, mm=0.001
    pageToModelScale: 1,    // from getPageToModelTransform
  }

  // Minimum screen size for markers (user preference)
  private minScreenPx: number = 12

  // Event listener refs (for cleanup)
  private boundCameraListener: (() => void) | null = null
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null
  private boundMouseMoveHandler: ((e: MouseEvent) => void) | null = null

  // Flag to prevent recursive selection changes
  private isSelectingSiblings = false

  constructor(viewer: Viewer3DInstance) {
    this.viewer = viewer
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize with Edit2D extension
   * Must be called after Edit2D is loaded and registerDefaultTools() is called
   */
  async initialize(edit2dContext: Edit2DContext): Promise<boolean> {
    try {
      this.ctx = edit2dContext

      // Get the Edit2D extension for access to static methods
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.edit2d = (this.viewer as any).getExtension('Autodesk.Edit2D') as Edit2DExtension

      if (!this.ctx || !this.edit2d) {
        console.error('[Edit2DMarkers] Edit2D context or extension not available')
        return false
      }

      // Set up event listeners
      this.setupSelectionListeners()
      this.setupHoverStyleModifier()
      this.setupKeyboardListeners()
      this.setupCameraListener()
      this.setupMouseMoveListener()

      // Inject hover CSS for labels (once per page)
      injectHoverStyles()

      return true
    } catch (err) {
      console.error('[Edit2DMarkers] Failed to initialize:', err)
      return false
    }
  }

  /**
   * Set unit scaling factors for proper symbol sizing
   */
  setUnitScales(modelUnitScale: number, pageToModelScale: number): void {
    this.unitScales = { modelUnitScale, pageToModelScale }
  }

  /**
   * Set minimum screen size for markers (from user preferences)
   * This affects the minimum font size of labels when zoomed out.
   */
  setMinScreenPx(value: number): void {
    this.minScreenPx = value
    // Update existing labels with new minimum size
    this.updateLabelStyles()
  }

  /**
   * Set callbacks for marker events
   */
  setCallbacks(callbacks: Edit2DMarkerCallbacks): void {
    this.callbacks = callbacks
  }

  // ============================================================================
  // CAMERA LISTENER (for dynamic label sizing)
  // ============================================================================

  /**
   * Set up camera change listener for dynamic label sizing
   * Uses CAMERA_TRANSITION_COMPLETED for performance (fires after zoom/pan ends)
   */
  private setupCameraListener(): void {
    if (!window.Autodesk?.Viewing?.CAMERA_TRANSITION_COMPLETED) return

    this.boundCameraListener = () => {
      this.updateLabelStyles()
    }

    this.viewer.addEventListener(
      window.Autodesk.Viewing.CAMERA_TRANSITION_COMPLETED,
      this.boundCameraListener
    )
  }

  /**
   * Update all label styles based on current zoom level and minScreenPx setting
   */
  private updateLabelStyles(): void {
    if (!this.labels.size) return

    const minFontSize = calculateMinFontSize(this.minScreenPx)
    for (const label of this.labels.values()) {
      applyLabelStyle(label, minFontSize)
    }
  }

  /**
   * Set up mousemove listener for hover detection using hit testing
   *
   * Edit2D's selection.hoveredId doesn't update reliably, so we use
   * mousemove + layer.hitTest() to detect which shape is under the cursor.
   */
  private setupMouseMoveListener(): void {
    const container = this.viewer.container
    if (!container || !this.ctx?.layer) return

    this.boundMouseMoveHandler = (e: MouseEvent) => {
      this.handleMouseMove(e)
    }

    container.addEventListener('mousemove', this.boundMouseMoveHandler)
  }

  /**
   * Handle mousemove for hover detection
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.ctx?.layer) return

    // Get mouse position relative to viewer container (canvas coordinates)
    const rect = this.viewer.container.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    // Convert canvas coordinates to layer (world) coordinates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layer = this.ctx.layer as any
    if (!layer.canvasToLayer) return

    const layerCoords = layer.canvasToLayer(canvasX, canvasY)
    if (!layerCoords) return

    // Use layer.hitTest with layer coordinates
    const hitResult = layer.hitTest(layerCoords.x, layerCoords.y)

    const hitShapeId = hitResult?.id ?? null

    // Find marker ID from hit shape
    const newHoveredMarkerId = hitShapeId !== null ? this.shapeToMarker.get(hitShapeId) ?? null : null

    // Update label scaling if hover changed
    if (newHoveredMarkerId !== this.hoveredMarkerId) {
      this.updateLabelHoverState(this.hoveredMarkerId, newHoveredMarkerId)
      this.hoveredMarkerId = newHoveredMarkerId
    }
  }

  // ============================================================================
  // SELECTION HANDLING
  // ============================================================================

  /**
   * Set up Edit2D selection event listeners
   */
  private setupSelectionListeners(): void {
    if (!this.ctx?.selection) return

    const selectionEvents = window.Autodesk?.Edit2D?.Selection?.Events
    if (selectionEvents) {
      this.ctx.selection.addEventListener(
        selectionEvents.SELECTION_CHANGED,
        this.handleSelectionChanged.bind(this)
      )

      // Also listen for hover changes
      this.ctx.selection.addEventListener(
        selectionEvents.SELECTION_HOVER_CHANGED,
        this.handleHoverChanged.bind(this)
      )
    }
  }

  /**
   * Set up hover style modifier for visual feedback
   *
   * Applies highlight effect to shapes when hovered, similar to measurement tools.
   * Also handles label scaling since the hover event is unreliable.
   */
  private setupHoverStyleModifier(): void {
    if (!this.ctx?.layer) return

    // Add custom hover style modifier
    this.ctx.layer.addStyleModifier((shape, style) => {
      // Only apply to our marker shapes
      if (!this.shapeToMarker.has(shape.id)) {
        return undefined
      }

      // Read hovered ID directly from selection (more reliable than event)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentHoveredId = (this.ctx?.selection as any)?.hoveredId ?? null

      // Check if this shape (or any sibling shape) is hovered
      const markerId = this.shapeToMarker.get(shape.id)
      const markerShapes = markerId ? this.shapes.get(markerId) : null
      const isHovered = markerShapes?.some(s => s.id === currentHoveredId) ?? false

      // Note: Label hover state is now handled by mousemove + hitTest
      // for more reliable detection (see setupMouseMoveListener)

      if (!isHovered) {
        return undefined
      }

      // Return modified style for hover effect (line only, no fill)
      const modified = style.clone()
      modified.lineColor = 'rgb(249, 115, 22)'  // Orange highlight
      return modified
    })
  }

  /**
   * Update label hover state - scale up/down label text elements
   *
   * We scale the textDiv directly (not the container) to avoid
   * breaking Edit2D's internal positioning transforms.
   * Uses CSS transition for smooth 1.5x scale animation.
   */
  private updateLabelHoverState(prevMarkerId: string | null, newMarkerId: string | null): void {
    // Remove scale from previous label (transition makes it animate back)
    if (prevMarkerId) {
      const prevLabel = this.labels.get(prevMarkerId)
      if (prevLabel?.textDiv) {
        // Keep transition for smooth scale-down animation
        prevLabel.textDiv.style.transition = 'transform 0.2s ease-out'
        prevLabel.textDiv.style.transform = 'scale(1)'
        prevLabel.textDiv.style.zIndex = ''
      }
    }

    // Apply scale to new label with smooth transition
    if (newMarkerId) {
      const newLabel = this.labels.get(newMarkerId)
      if (newLabel?.textDiv) {
        newLabel.textDiv.style.transition = 'transform 0.2s ease-out'
        newLabel.textDiv.style.transformOrigin = 'center center'
        newLabel.textDiv.style.transform = 'scale(1.5)'
        newLabel.textDiv.style.zIndex = '1000'
      }
    }
  }

  // Track currently hovered marker ID for label styling
  private hoveredMarkerId: string | null = null

  /**
   * Handle hover change events from Edit2D selection
   *
   * Note: This is kept as a backup but the style modifier now handles
   * hover state directly for more reliable behavior.
   */
  private handleHoverChanged(): void {
    // Trigger layer update to apply style modifier
    this.ctx?.layer?.update?.()
  }

  /**
   * Handle Edit2D selection change events
   *
   * When a shape is selected, automatically selects ALL shapes belonging to the same marker.
   * This makes multi-shape markers behave as a single grouped object.
   */
  private handleSelectionChanged(): void {
    if (!this.ctx?.selection) return

    // Prevent infinite recursion when we programmatically select sibling shapes
    if (this.isSelectingSiblings) return

    // Before updating selection, check if the previously selected marker moved
    if (this.selectedId) {
      this.checkForMoveAndUpdate(this.selectedId)
    }

    const selectedShapes = this.ctx.selection.getSelectedShapes()

    if (selectedShapes.length === 0) {
      if (this.selectedId) {
        this.selectedId = null
        this.callbacks.onSelect?.(null)
      }
      return
    }

    // Find the marker ID using the reverse lookup
    const selectedShape = selectedShapes[0]
    const markerId = this.shapeToMarker.get(selectedShape.id)

    if (!markerId) return

    // Get ALL shapes belonging to this marker
    const allMarkerShapes = this.shapes.get(markerId)

    // If the marker has multiple shapes and not all are selected, select them all
    if (allMarkerShapes && allMarkerShapes.length > 1) {
      const selectedIds = new Set(selectedShapes.map(s => s.id))
      const allSelected = allMarkerShapes.every(s => selectedIds.has(s.id))

      if (!allSelected) {
        this.isSelectingSiblings = true
        try {
          // Select the primary shape (first in array) to represent the marker group
          // Note: Edit2D only supports single-shape selection via selectOnly()
          // Multi-shape visual selection isn't supported, but our logical selection
          // tracking via this.selectedId handles the marker as a unit
          this.ctx.selection.selectOnly(allMarkerShapes[0])
        } finally {
          this.isSelectingSiblings = false
        }
      }
    }

    if (this.selectedId !== markerId) {
      this.selectedId = markerId
      this.callbacks.onSelect?.(markerId)
    }
  }

  /**
   * Check if a marker's shapes have moved and update stored coordinates
   */
  private checkForMoveAndUpdate(markerId: string): void {
    const data = this.markerData.get(markerId)
    const shapes = this.shapes.get(markerId)

    if (!data || !shapes || shapes.length === 0) return

    const firstShape = shapes[0]
    const bbox = firstShape.getBBox?.()
    if (!bbox) return

    const newX = (bbox.min.x + bbox.max.x) / 2
    const newY = (bbox.min.y + bbox.max.y) / 2

    const dx = Math.abs(newX - data.pageX)
    const dy = Math.abs(newY - data.pageY)
    const moveThreshold = 0.1

    if (dx > moveThreshold || dy > moveThreshold) {
      data.pageX = newX
      data.pageY = newY
      this.markerData.set(markerId, data)
      this.callbacks.onMove?.(markerId, newX, newY)
    }
  }

  // ============================================================================
  // KEYBOARD HANDLING
  // ============================================================================

  private setupKeyboardListeners(): void {
    this.boundKeyHandler = this.handleKeyDown.bind(this)
    // Use capture phase to intercept BEFORE Edit2D's handlers
    window.addEventListener('keydown', this.boundKeyHandler, true)
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Don't handle if user is typing in an input
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    // Delete selected marker (all shapes)
    if (this.selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()
      e.stopPropagation()  // Prevent Edit2D from deleting individual shapes
      this.deleteMarker(this.selectedId)
    }

    // Rotate selected marker by 15 degrees
    // R = clockwise, Shift+R = counter-clockwise
    if (this.selectedId && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.shiftKey ? 15 : -15  // CW is negative in math coordinates
      this.rotateMarker(this.selectedId, delta)
    }
  }

  // ============================================================================
  // MARKER CREATION
  // ============================================================================

  /**
   * Add a marker at page coordinates
   *
   * @param pageX - Edit2D page X coordinate
   * @param pageY - Edit2D page Y coordinate
   * @param data - Marker data (productId, symbol, etc.)
   * @param id - Optional marker ID (generates UUID if not provided)
   * @param rotation - Initial rotation in degrees
   */
  async addMarker(
    pageX: number,
    pageY: number,
    data: Omit<Edit2DMarkerData, 'id' | 'pageX' | 'pageY' | 'rotation'>,
    id?: string,
    rotation: number = 0
  ): Promise<Edit2DMarkerData | null> {
    if (!this.ctx) {
      console.error('[Edit2DMarkers] Context not initialized')
      return null
    }

    const markerId = id || crypto.randomUUID()
    const markerData: Edit2DMarkerData = {
      ...data,
      id: markerId,
      pageX,
      pageY,
      rotation,
    }

    // Check if this symbol group is hidden
    const isHidden = data.symbol ? this.hiddenGroups.has(data.symbol) : false

    // Try to load SVG symbol
    let shapes: Edit2DShape[] | null = null
    const fossPid = data.fossPid || data.productName

    if (fossPid) {
      const svgContent = await this.svgFetcher.fetchSymbolSvg(fossPid)
      if (svgContent) {
        shapes = createShapesFromSvg(svgContent, pageX, pageY, rotation, this.unitScales)
      }
    }

    // Fall back to circle marker if no SVG
    if (!shapes) {
      shapes = createFallbackCircleShape(pageX, pageY, this.unitScales)
    }

    if (!shapes || shapes.length === 0) {
      console.error('[Edit2DMarkers] Failed to create shapes')
      return null
    }

    // Store the marker (all shapes) and populate reverse lookup
    this.shapes.set(markerId, shapes)
    for (const shape of shapes) {
      this.shapeToMarker.set(shape.id, markerId)
    }
    this.markerData.set(markerId, markerData)

    // Add all shapes to layer (only if not hidden)
    if (!isHidden) {
      for (const shape of shapes) {
        this.ctx.addShape(shape)
      }

      // Add label to first shape if symbol is provided
      if (data.symbol && shapes[0]) {
        this.addLabelToShape(markerId, shapes[0], data.symbol)
      }
    }

    return markerData
  }

  /**
   * Add a text label to a shape
   */
  private addLabelToShape(markerId: string, shape: Edit2DShape, text: string): void {
    if (!this.ctx) return

    const minFontSize = calculateMinFontSize(this.minScreenPx)
    const label = createShapeLabel(shape, text, this.ctx, minFontSize)

    if (label) {
      this.labels.set(markerId, label)
    }
  }

  // ============================================================================
  // MARKER OPERATIONS
  // ============================================================================

  /**
   * Select a marker by ID
   */
  selectMarker(id: string | null): void {
    if (!this.ctx?.selection) return

    if (id === null) {
      this.ctx.selection.clear()
      this.selectedId = null
      this.callbacks.onSelect?.(null)
      return
    }

    const shapes = this.shapes.get(id)
    if (shapes && shapes.length > 0) {
      this.ctx.selection.selectOnly(shapes[0])
      this.selectedId = id
      this.callbacks.onSelect?.(id)
    }
  }

  /**
   * Delete a marker by ID
   */
  deleteMarker(id: string): void {
    if (!this.ctx) return

    const shapes = this.shapes.get(id)
    if (shapes) {
      // Remove all shapes from layer and reverse lookup
      for (const shape of shapes) {
        this.ctx.removeShape(shape)
        this.shapeToMarker.delete(shape.id)
      }

      // Remove label if exists
      const label = this.labels.get(id)
      if (label) {
        label.setVisible(false)
        this.labels.delete(id)
      }

      // Clear from maps
      this.shapes.delete(id)
      this.markerData.delete(id)

      // Clear selection if this was selected
      if (this.selectedId === id) {
        this.selectedId = null
        this.callbacks.onSelect?.(null)
      }

      this.callbacks.onDelete?.(id)
    }
  }

  /**
   * Delete the currently selected marker (for toolbar button)
   */
  deleteSelected(): void {
    if (this.selectedId) {
      this.deleteMarker(this.selectedId)
    }
  }

  /**
   * Rotate a marker by delta degrees
   *
   * Recreates all shapes with the new rotation angle.
   */
  async rotateMarker(id: string, deltaDegrees: number): Promise<void> {
    const data = this.markerData.get(id)
    const existingShapes = this.shapes.get(id)

    if (!data || !existingShapes || !this.ctx) return

    // Calculate new rotation (normalize to 0-360)
    let newRotation = (data.rotation + deltaDegrees) % 360
    if (newRotation < 0) newRotation += 360

    // Remove old shapes from layer and reverse lookup
    for (const shape of existingShapes) {
      this.ctx.removeShape(shape)
      this.shapeToMarker.delete(shape.id)
    }

    // Remove label if exists
    const label = this.labels.get(id)
    if (label) {
      label.setVisible(false)
      this.labels.delete(id)
    }

    // Update stored rotation
    data.rotation = newRotation
    this.markerData.set(id, data)

    // Recreate shapes with new rotation
    let newShapes: Edit2DShape[] | null = null
    const fossPid = data.fossPid || data.productName

    if (fossPid) {
      const svgContent = await this.svgFetcher.fetchSymbolSvg(fossPid)
      if (svgContent) {
        newShapes = createShapesFromSvg(svgContent, data.pageX, data.pageY, newRotation, this.unitScales)
      }
    }

    // Fall back to circle if no SVG
    if (!newShapes) {
      newShapes = createFallbackCircleShape(data.pageX, data.pageY, this.unitScales)
    }

    if (!newShapes || newShapes.length === 0) {
      console.error(`[Edit2DMarkers] Failed to recreate shapes for rotation: ${id}`)
      return
    }

    // Store new shapes and update reverse lookup
    this.shapes.set(id, newShapes)
    for (const shape of newShapes) {
      this.shapeToMarker.set(shape.id, id)
    }

    // Add new shapes to layer (only if not hidden)
    const isHidden = data.symbol ? this.hiddenGroups.has(data.symbol) : false
    if (!isHidden) {
      for (const shape of newShapes) {
        this.ctx.addShape(shape)
      }

      // Re-add label
      if (data.symbol && newShapes[0]) {
        this.addLabelToShape(id, newShapes[0], data.symbol)
      }
    }

    this.callbacks.onRotate?.(id, newRotation)
  }

  /**
   * Get marker data by ID
   */
  getMarkerData(id: string): Edit2DMarkerData | undefined {
    return this.markerData.get(id)
  }

  /**
   * Get all marker data
   */
  getAllMarkers(): Edit2DMarkerData[] {
    return Array.from(this.markerData.values())
  }

  // ============================================================================
  // VISIBILITY MANAGEMENT
  // ============================================================================

  /**
   * Hide all markers with the given symbol
   */
  hideSymbolGroup(symbol: string): void {
    if (this.hiddenGroups.has(symbol)) return
    if (!this.ctx) return

    this.hiddenGroups.add(symbol)

    for (const [id, data] of this.markerData) {
      if (data.symbol === symbol) {
        const shapes = this.shapes.get(id)
        if (shapes) {
          for (const shape of shapes) {
            this.ctx.removeShape(shape)
          }
        }
      }
    }
  }

  /**
   * Show all markers with the given symbol
   */
  showSymbolGroup(symbol: string): void {
    if (!this.hiddenGroups.has(symbol)) return
    if (!this.ctx) return

    this.hiddenGroups.delete(symbol)

    for (const [id, data] of this.markerData) {
      if (data.symbol === symbol) {
        const shapes = this.shapes.get(id)
        if (shapes) {
          for (const shape of shapes) {
            this.ctx.addShape(shape)
          }
        }
      }
    }
  }

  /**
   * Apply visibility from a Set of hidden symbols
   */
  applyHiddenGroups(newHiddenGroups: Set<string>): void {
    // Show groups that are no longer hidden
    for (const symbol of this.hiddenGroups) {
      if (!newHiddenGroups.has(symbol)) {
        this.showSymbolGroup(symbol)
      }
    }

    // Hide groups that are now hidden
    for (const symbol of newHiddenGroups) {
      if (!this.hiddenGroups.has(symbol)) {
        this.hideSymbolGroup(symbol)
      }
    }
  }

  /**
   * Check if a symbol group is hidden
   */
  isSymbolHidden(symbol: string): boolean {
    return this.hiddenGroups.has(symbol)
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Clear all markers
   */
  clearAll(): void {
    // Hide all labels first (they're DOM elements, not cleared by clearLayer)
    for (const label of this.labels.values()) {
      label.setVisible(false)
    }

    if (this.ctx) {
      this.ctx.clearLayer()
    }

    this.shapes.clear()
    this.shapeToMarker.clear()
    this.markerData.clear()
    this.labels.clear()
    this.hiddenGroups.clear()
    this.selectedId = null
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    // Remove keyboard listener (must match capture: true from setup)
    if (this.boundKeyHandler) {
      window.removeEventListener('keydown', this.boundKeyHandler, true)
      this.boundKeyHandler = null
    }

    // Remove camera change listener
    if (this.boundCameraListener && window.Autodesk?.Viewing?.CAMERA_TRANSITION_COMPLETED) {
      this.viewer.removeEventListener(
        window.Autodesk.Viewing.CAMERA_TRANSITION_COMPLETED,
        this.boundCameraListener
      )
      this.boundCameraListener = null
    }

    // Remove mousemove listener
    if (this.boundMouseMoveHandler) {
      this.viewer.container?.removeEventListener('mousemove', this.boundMouseMoveHandler)
      this.boundMouseMoveHandler = null
    }

    this.clearAll()
    this.ctx = null
    this.edit2d = null
  }
}
