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
 *
 * Architecture:
 * - Move mode logic delegated to MarkerMoveController
 * - Visibility logic delegated to MarkerVisibilityController
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
import { STYLE_CONSTANTS } from './style-manager'
import { SvgFetcher } from './svg-fetcher'
import { createShapesFromSvg, createFallbackCircleShape } from './shape-factory'
import {
  type ShapeLabel,
  applyLabelStyle,
  calculateMinFontSize,
  createShapeLabel,
} from './label-utils'
import { MarkerMoveController, type MarkerMoveParent } from './marker-move-controller'
import { MarkerVisibilityController, type MarkerVisibilityParent } from './marker-visibility-controller'

/**
 * Edit2DMarkers - Manages luminaire markers using Edit2D extension
 *
 * @remarks
 * This class provides the same functionality as MarkupMarkers but uses
 * Edit2D's managed shape system for proper selection, visibility, and
 * manipulation support.
 */
export class Edit2DMarkers implements MarkerMoveParent, MarkerVisibilityParent {
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

  // Track currently hovered marker ID for label styling
  private hoveredMarkerId: string | null = null

  // Delegated controllers
  private moveController: MarkerMoveController
  private visibilityController: MarkerVisibilityController

  constructor(viewer: Viewer3DInstance) {
    this.viewer = viewer
    this.moveController = new MarkerMoveController(this)
    this.visibilityController = new MarkerVisibilityController(this)
  }

  // ============================================================================
  // CONTROLLER INTERFACE IMPLEMENTATIONS
  // ============================================================================

  /** @internal Used by controllers */
  getContext(): Edit2DContext | null {
    return this.ctx
  }

  /** @internal Used by controllers */
  getMarkerData(id: string): Edit2DMarkerData | undefined {
    return this.markerData.get(id)
  }

  /** @internal Used by controllers */
  getMarkerShapes(id: string): Edit2DShape[] | undefined {
    return this.shapes.get(id)
  }

  /** @internal Used by controllers */
  getLabel(id: string): ShapeLabel | undefined {
    return this.labels.get(id)
  }

  /** @internal Used by controllers */
  getAllMarkerData(): Map<string, Edit2DMarkerData> {
    return this.markerData
  }

  /** @internal Used by controllers */
  getUnitScales(): UnitScales {
    return this.unitScales
  }

  /** @internal Used by controllers */
  getCallbacks(): Edit2DMarkerCallbacks {
    return this.callbacks
  }

  /** @internal Used by controllers */
  getSvgFetcher(): SvgFetcher {
    return this.svgFetcher
  }

  /** @internal Used by controllers */
  updateMarkerShapes(id: string, shapes: Edit2DShape[]): void {
    // Remove old shapes from reverse lookup
    const oldShapes = this.shapes.get(id)
    if (oldShapes) {
      for (const shape of oldShapes) {
        this.shapeToMarker.delete(shape.id)
      }
    }

    // Store new shapes and update reverse lookup
    this.shapes.set(id, shapes)
    for (const shape of shapes) {
      this.shapeToMarker.set(shape.id, id)
    }
  }

  /** @internal Used by controllers */
  updateMarkerPosition(id: string, pageX: number, pageY: number): void {
    const data = this.markerData.get(id)
    if (data) {
      data.pageX = pageX
      data.pageY = pageY
      this.markerData.set(id, data)
    }
  }

  /** @internal Used by controllers */
  addLabelToShape(markerId: string, shape: Edit2DShape, text: string): void {
    if (!this.ctx) return

    const minFontSize = calculateMinFontSize(this.minScreenPx)
    const label = createShapeLabel(shape, text, this.ctx, minFontSize)

    if (label) {
      this.labels.set(markerId, label)
    }
  }

  /** @internal Used by controllers */
  removeLabel(id: string): void {
    const label = this.labels.get(id)
    if (label) {
      label.setVisible(false)
      this.labels.delete(id)
    }
  }

  /** @internal Used by controllers */
  clearSelection(): void {
    if (this.ctx?.selection) {
      this.ctx.selection.clear()
    }
    this.selectedId = null
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
    this.updateLabelStyles()
  }

  /**
   * Set callbacks for marker events
   */
  setCallbacks(callbacks: Edit2DMarkerCallbacks): void {
    this.callbacks = callbacks
  }

  // ============================================================================
  // EVENT SETUP
  // ============================================================================

  /**
   * Set up camera change listener for dynamic label sizing
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
   * Handle mousemove for hover detection and move preview
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.ctx?.layer) return

    // Get mouse position relative to viewer container (canvas coordinates)
    const rect = this.viewer.container.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    // Update move preview if in move mode
    if (this.moveController.isMoving()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const worldResult = (this.viewer as any).clientToWorld(canvasX, canvasY)
      if (worldResult?.point) {
        this.moveController.updateMovePreview(worldResult.point.x, worldResult.point.y)
      }
      return // Skip hover detection during move mode
    }

    // Convert canvas coordinates to layer coordinates for hit testing
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

      this.ctx.selection.addEventListener(
        selectionEvents.SELECTION_HOVER_CHANGED,
        this.handleHoverChanged.bind(this)
      )
    }
  }

  /**
   * Set up style modifier for hover and selection visual feedback
   */
  private setupHoverStyleModifier(): void {
    if (!this.ctx?.layer) return

    this.ctx.layer.addStyleModifier((shape, style) => {
      // Only apply to our marker shapes
      if (!this.shapeToMarker.has(shape.id)) {
        return undefined
      }

      const markerId = this.shapeToMarker.get(shape.id)
      const markerShapes = markerId ? this.shapes.get(markerId) : null

      // Check if this marker is selected
      const isSelected = markerId === this.selectedId

      // Read hovered ID directly from selection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentHoveredId = (this.ctx?.selection as any)?.hoveredId ?? null
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
   * Update label hover state - scale up/down label text elements
   */
  private updateLabelHoverState(prevMarkerId: string | null, newMarkerId: string | null): void {
    // Remove scale from previous label
    if (prevMarkerId) {
      const prevLabel = this.labels.get(prevMarkerId)
      if (prevLabel?.textDiv) {
        prevLabel.textDiv.style.transition = 'transform 0.2s ease-out'
        prevLabel.textDiv.style.transform = 'scale(1)'
        prevLabel.textDiv.style.zIndex = ''
      }
    }

    // Apply scale to new label
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

  /**
   * Handle hover change events from Edit2D selection
   */
  private handleHoverChanged(): void {
    this.ctx?.layer?.update?.()
  }

  /**
   * Handle Edit2D selection change events
   */
  private handleSelectionChanged(): void {
    if (!this.ctx?.selection) return

    // Prevent recursion when we programmatically clear selection
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
        this.ctx.layer.update()
      }
      return
    }

    // Find the marker ID using the reverse lookup
    const selectedShape = selectedShapes[0]
    const markerId = this.shapeToMarker.get(selectedShape.id)

    if (!markerId) {
      this.isSelectingSiblings = true
      this.ctx.selection.clear()
      this.isSelectingSiblings = false
      return
    }

    // Update our internal selection state
    if (this.selectedId !== markerId) {
      this.selectedId = markerId
      this.callbacks.onSelect?.(markerId)
    }

    // Clear Edit2D selection to hide the gizmo
    this.isSelectingSiblings = true
    this.ctx.selection.clear()
    this.isSelectingSiblings = false

    this.ctx.layer.update()
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
    window.addEventListener('keydown', this.boundKeyHandler, true)
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    // ESC: Cancel move mode
    if (e.key === 'Escape' && this.moveController.isMoving()) {
      e.preventDefault()
      e.stopPropagation()
      this.moveController.cancelMove()
      return
    }

    // Delete selected marker
    if (this.selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()
      e.stopPropagation()
      this.deleteMarker(this.selectedId)
    }

    // Rotate selected marker by 15 degrees
    if (this.selectedId && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.shiftKey ? 15 : -15
      this.rotateMarker(this.selectedId, delta)
    }

    // M key: Start move mode for selected marker
    if (this.selectedId && !this.moveController.isMoving() && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault()
      e.stopPropagation()
      this.moveController.startMove(this.selectedId)
    }
  }

  // ============================================================================
  // MARKER CREATION
  // ============================================================================

  /**
   * Add a marker at page coordinates
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
    const isHidden = data.symbol ? this.visibilityController.isSymbolHidden(data.symbol) : false

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

    // Store the marker and populate reverse lookup
    this.shapes.set(markerId, shapes)
    for (const shape of shapes) {
      this.shapeToMarker.set(shape.id, markerId)
    }
    this.markerData.set(markerId, markerData)

    // Add shapes to layer (only if not hidden)
    if (!isHidden) {
      for (const shape of shapes) {
        this.ctx.addShape(shape)
      }

      if (data.symbol && shapes[0]) {
        this.addLabelToShape(markerId, shapes[0], data.symbol)
      }
    }

    // Clear selection to prevent newly placed marker from appearing selected
    this.ctx.selection.clear()
    this.selectedId = null

    return markerData
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
      this.ctx.layer.update()
      return
    }

    const shapes = this.shapes.get(id)
    if (shapes && shapes.length > 0) {
      this.ctx.selection.selectOnly(shapes[0])
      this.selectedId = id
      this.callbacks.onSelect?.(id)
      this.ctx.layer.update()
    }
  }

  /**
   * Delete a marker by ID
   */
  deleteMarker(id: string): void {
    if (!this.ctx) return

    const shapes = this.shapes.get(id)
    if (shapes) {
      for (const shape of shapes) {
        this.ctx.removeShape(shape)
        this.shapeToMarker.delete(shape.id)
      }

      this.removeLabel(id)
      this.shapes.delete(id)
      this.markerData.delete(id)

      if (this.selectedId === id) {
        this.selectedId = null
        this.callbacks.onSelect?.(null)
      }

      this.callbacks.onDelete?.(id)
    }
  }

  /**
   * Delete the currently selected marker
   */
  deleteSelected(): void {
    if (this.selectedId) {
      this.deleteMarker(this.selectedId)
    }
  }

  /**
   * Rotate a marker by delta degrees
   */
  async rotateMarker(id: string, deltaDegrees: number): Promise<void> {
    const data = this.markerData.get(id)
    const existingShapes = this.shapes.get(id)

    if (!data || !existingShapes || !this.ctx) return

    // Calculate new rotation (normalize to 0-360)
    let newRotation = (data.rotation + deltaDegrees) % 360
    if (newRotation < 0) newRotation += 360

    // Remove old shapes
    for (const shape of existingShapes) {
      this.ctx.removeShape(shape)
      this.shapeToMarker.delete(shape.id)
    }

    this.removeLabel(id)

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

    if (!newShapes) {
      newShapes = createFallbackCircleShape(data.pageX, data.pageY, this.unitScales)
    }

    if (!newShapes || newShapes.length === 0) {
      console.error(`[Edit2DMarkers] Failed to recreate shapes for rotation: ${id}`)
      return
    }

    // Store new shapes
    this.shapes.set(id, newShapes)
    for (const shape of newShapes) {
      this.shapeToMarker.set(shape.id, id)
    }

    // Add new shapes (only if not hidden)
    const isHidden = data.symbol ? this.visibilityController.isSymbolHidden(data.symbol) : false
    if (!isHidden) {
      for (const shape of newShapes) {
        this.ctx.addShape(shape)
      }

      if (data.symbol && newShapes[0]) {
        this.addLabelToShape(id, newShapes[0], data.symbol)
      }
    }

    this.callbacks.onRotate?.(id, newRotation)
  }

  // ============================================================================
  // MOVE MODE DELEGATION
  // ============================================================================

  /**
   * Check if currently in move mode
   */
  isMoving(): boolean {
    return this.moveController.isMoving()
  }

  /**
   * Get the ID of the marker being moved
   */
  getMovingMarkerId(): string | null {
    return this.moveController.getMovingMarkerId()
  }

  /**
   * Start move mode for a marker
   */
  startMove(id: string): void {
    this.moveController.startMove(id)
  }

  /**
   * Cancel move mode
   */
  cancelMove(): void {
    this.moveController.cancelMove()
  }

  /**
   * Update move preview
   */
  async updateMovePreview(pageX: number, pageY: number): Promise<void> {
    await this.moveController.updateMovePreview(pageX, pageY)
  }

  /**
   * Confirm move at new position
   */
  async confirmMove(pageX: number, pageY: number): Promise<void> {
    await this.moveController.confirmMove(pageX, pageY)
  }

  // ============================================================================
  // VISIBILITY DELEGATION
  // ============================================================================

  /**
   * Hide all markers with the given symbol
   */
  hideSymbolGroup(symbol: string): void {
    this.visibilityController.hideSymbolGroup(symbol)
  }

  /**
   * Show all markers with the given symbol
   */
  showSymbolGroup(symbol: string): void {
    this.visibilityController.showSymbolGroup(symbol)
  }

  /**
   * Apply visibility from a Set of hidden symbols
   */
  applyHiddenGroups(newHiddenGroups: Set<string>): void {
    this.visibilityController.applyHiddenGroups(newHiddenGroups)
  }

  /**
   * Check if a symbol group is hidden
   */
  isSymbolHidden(symbol: string): boolean {
    return this.visibilityController.isSymbolHidden(symbol)
  }

  // ============================================================================
  // DATA ACCESS
  // ============================================================================

  /**
   * Get all marker data
   */
  getAllMarkers(): Edit2DMarkerData[] {
    return Array.from(this.markerData.values())
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Clear all markers
   */
  clearAll(): void {
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
    this.selectedId = null

    this.visibilityController.dispose()
    this.moveController.dispose()
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    if (this.boundKeyHandler) {
      window.removeEventListener('keydown', this.boundKeyHandler, true)
      this.boundKeyHandler = null
    }

    if (this.boundCameraListener && window.Autodesk?.Viewing?.CAMERA_TRANSITION_COMPLETED) {
      this.viewer.removeEventListener(
        window.Autodesk.Viewing.CAMERA_TRANSITION_COMPLETED,
        this.boundCameraListener
      )
      this.boundCameraListener = null
    }

    if (this.boundMouseMoveHandler) {
      this.viewer.container?.removeEventListener('mousemove', this.boundMouseMoveHandler)
      this.boundMouseMoveHandler = null
    }

    this.clearAll()
    this.ctx = null
    this.edit2d = null
  }
}
