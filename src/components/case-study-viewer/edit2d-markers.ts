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
// Note: Edit2D's Shape.fromSVG() doesn't handle arc commands in path strings.
// Instead, we use native Edit2D classes: PolygonPath.setEllipseArc() for true circles,
// Polygon for rectangles, and Polyline for lines - giving smooth, accurate shapes.

// Supabase storage URL for product symbols
const SYMBOLS_BUCKET_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-symbols`

// Unit conversion constants
const MM_TO_METERS = 0.001

// Default circle marker size when no SVG symbol available
const DEFAULT_MARKER_RADIUS_MM = 50 // 50mm radius = 100mm diameter

/**
 * Data associated with each placed marker
 */
export interface Edit2DMarkerData {
  id: string
  productId: string
  projectProductId: string
  productName: string
  fossPid?: string      // FOSS product ID for symbol lookup
  symbol?: string       // Symbol label (e.g., "A1", "B2")
  pageX: number         // Edit2D page X coordinate
  pageY: number         // Edit2D page Y coordinate
  rotation: number      // Rotation in degrees (0-360)
}

/**
 * Callbacks for marker events
 */
export interface Edit2DMarkerCallbacks {
  onSelect?: (id: string | null) => void
  onDelete?: (id: string) => void
  onRotate?: (id: string, rotation: number) => void
  onMove?: (id: string, pageX: number, pageY: number) => void
}

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
  private labels: Map<string, unknown> = new Map()

  // Selection state
  private selectedId: string | null = null

  // Callbacks
  private callbacks: Edit2DMarkerCallbacks = {}

  // SVG symbol cache: fossPid -> SVG content (or null if no symbol)
  private svgCache: Map<string, string | null> = new Map()
  private svgFetchPromises: Map<string, Promise<string | null>> = new Map()

  // Hidden symbol groups (by full symbol, e.g., "A1", "B2")
  private hiddenGroups: Set<string> = new Set()

  // Unit scaling factors (set after model loads)
  private modelUnitScale: number = 1      // meters=1, mm=0.001
  private pageToModelScale: number = 1    // from getPageToModelTransform

  constructor(viewer: Viewer3DInstance) {
    this.viewer = viewer
  }

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

      // Set up selection event listeners
      this.setupSelectionListeners()

      // Set up keyboard listeners
      this.setupKeyboardListeners()

      console.log('[Edit2DMarkers] Initialized successfully')
      return true
    } catch (err) {
      console.error('[Edit2DMarkers] Failed to initialize:', err)
      return false
    }
  }

  /**
   * Set unit scaling factors for proper symbol sizing
   */
  setUnitScales(modelUnitScale: number, pageToModelScale: number) {
    this.modelUnitScale = modelUnitScale
    this.pageToModelScale = pageToModelScale
    console.log(`[Edit2DMarkers] Unit scales set: modelUnit=${modelUnitScale}, pageToModel=${pageToModelScale}`)
  }

  /**
   * Set callbacks for marker events
   */
  setCallbacks(callbacks: Edit2DMarkerCallbacks) {
    this.callbacks = callbacks
  }

  // ============================================================================
  // SELECTION HANDLING
  // ============================================================================

  /**
   * Set up Edit2D selection event listeners
   */
  private setupSelectionListeners() {
    if (!this.ctx?.selection) return

    // Listen for selection changes
    const selectionEvents = window.Autodesk?.Edit2D?.Selection?.Events
    if (selectionEvents) {
      this.ctx.selection.addEventListener(
        selectionEvents.SELECTION_CHANGED,
        this.handleSelectionChanged.bind(this)
      )
    }
  }

  /**
   * Handle Edit2D selection change events
   *
   * Also checks if the previously selected marker moved (drag detection).
   */
  private handleSelectionChanged() {
    if (!this.ctx?.selection) return

    // Before updating selection, check if the previously selected marker moved
    if (this.selectedId) {
      this.checkForMoveAndUpdate(this.selectedId)
    }

    const selectedShapes = this.ctx.selection.getSelectedShapes()

    if (selectedShapes.length === 0) {
      // Nothing selected
      if (this.selectedId) {
        this.selectedId = null
        this.callbacks.onSelect?.(null)
      }
      return
    }

    // Find the marker ID using the reverse lookup
    const selectedShape = selectedShapes[0]
    const markerId = this.shapeToMarker.get(selectedShape.id)

    if (markerId && this.selectedId !== markerId) {
      this.selectedId = markerId
      this.callbacks.onSelect?.(markerId)
    }
  }

  /**
   * Check if a marker's shapes have moved and update stored coordinates
   *
   * Called on selection change to detect drag completion.
   */
  private checkForMoveAndUpdate(markerId: string) {
    const data = this.markerData.get(markerId)
    const shapes = this.shapes.get(markerId)

    if (!data || !shapes || shapes.length === 0) return

    // Get the first shape's bounding box center as the marker position
    const firstShape = shapes[0]
    const bbox = firstShape.getBBox?.()
    if (!bbox) return

    const newX = (bbox.min.x + bbox.max.x) / 2
    const newY = (bbox.min.y + bbox.max.y) / 2

    // Check if position changed significantly (more than 0.1 page units)
    const dx = Math.abs(newX - data.pageX)
    const dy = Math.abs(newY - data.pageY)
    const moveThreshold = 0.1

    if (dx > moveThreshold || dy > moveThreshold) {
      console.log(`[Edit2DMarkers] Detected move: ${markerId} from (${data.pageX.toFixed(2)}, ${data.pageY.toFixed(2)}) to (${newX.toFixed(2)}, ${newY.toFixed(2)})`)

      // Update stored coordinates
      data.pageX = newX
      data.pageY = newY
      this.markerData.set(markerId, data)

      // Notify callback
      this.callbacks.onMove?.(markerId, newX, newY)
    }
  }

  // ============================================================================
  // KEYBOARD HANDLING
  // ============================================================================

  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null

  private setupKeyboardListeners() {
    this.boundKeyHandler = this.handleKeyDown.bind(this)
    // Use capture phase to intercept BEFORE Edit2D's handlers
    window.addEventListener('keydown', this.boundKeyHandler, true)
  }

  private handleKeyDown(e: KeyboardEvent) {
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
    if (this.selectedId && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault()
      e.stopPropagation()
      this.rotateMarker(this.selectedId, 15)
    }
  }

  // ============================================================================
  // SVG SYMBOL LOADING
  // ============================================================================

  /**
   * Fetch SVG symbol for a product (with caching)
   */
  private async fetchSymbolSvg(fossPid: string): Promise<string | null> {
    // Check cache first
    if (this.svgCache.has(fossPid)) {
      return this.svgCache.get(fossPid) ?? null
    }

    // Check if already fetching
    const pendingFetch = this.svgFetchPromises.get(fossPid)
    if (pendingFetch) {
      return pendingFetch
    }

    // Start fetch
    const fetchPromise = (async () => {
      try {
        const url = `${SYMBOLS_BUCKET_URL}/${fossPid}/${fossPid}-SYMBOL.svg?t=${Date.now()}`
        const response = await fetch(url)

        if (response.ok) {
          const svgText = await response.text()
          this.svgCache.set(fossPid, svgText)
          return svgText
        }

        this.svgCache.set(fossPid, null)
        return null
      } catch (err) {
        console.warn(`[Edit2DMarkers] Failed to fetch SVG for ${fossPid}:`, err)
        this.svgCache.set(fossPid, null)
        return null
      } finally {
        this.svgFetchPromises.delete(fossPid)
      }
    })()

    this.svgFetchPromises.set(fossPid, fetchPromise)
    return fetchPromise
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
    console.log('[Edit2DMarkers] addMarker: fossPid =', fossPid)

    if (fossPid) {
      const svgContent = await this.fetchSymbolSvg(fossPid)
      console.log('[Edit2DMarkers] addMarker: svgContent =', svgContent ? `${svgContent.length} chars` : 'null')
      if (svgContent) {
        console.log('[Edit2DMarkers] addMarker: calling createShapeFromSvg')
        shapes = this.createShapeFromSvg(svgContent, pageX, pageY, rotation)
        console.log('[Edit2DMarkers] addMarker: createShapeFromSvg returned', shapes ? `${shapes.length} shapes` : 'null')
      }
    }

    // Fall back to circle marker if no SVG
    if (!shapes) {
      console.log('[Edit2DMarkers] addMarker: falling back to createCircleShape')
      shapes = this.createCircleShape(pageX, pageY, rotation, data.symbol)
      console.log('[Edit2DMarkers] addMarker: createCircleShape returned', shapes ? `${shapes.length} shapes` : 'null')
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

    const hiddenNote = isHidden ? ' (hidden)' : ''
    console.log(`[Edit2DMarkers] Added marker: ${markerId} at (${pageX.toFixed(2)}, ${pageY.toFixed(2)})${hiddenNote}`)

    return markerData
  }

  /**
   * Create Edit2D shapes from SVG content
   *
   * Handles SVG primitives using Edit2D's native shape classes:
   * - <rect> → Polygon (4-point closed shape)
   * - <circle> → PolygonPath with setEllipseArc() (true circles, not polygon approximations)
   * - <line> → Polyline (native line primitive)
   *
   * This approach gives smooth, geometrically accurate shapes compared to
   * polygon approximations or string-based fromSVG() parsing.
   *
   * @returns Array of all shapes created, or null on failure
   */
  private createShapeFromSvg(
    svgContent: string,
    pageX: number,
    pageY: number,
    rotation: number
  ): Edit2DShape[] | null {
    const Edit2D = window.Autodesk?.Edit2D
    if (!Edit2D?.Polygon || !Edit2D?.PolygonPath || !Edit2D?.Polyline || !Edit2D?.EllipseArcParams) {
      console.warn('[Edit2DMarkers] Autodesk.Edit2D shape classes not available')
      return null
    }

    try {
      // Parse SVG
      const parser = new DOMParser()
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml')
      const svgElement = svgDoc.querySelector('svg')

      if (!svgElement) {
        console.warn('[Edit2DMarkers] No SVG element found')
        return null
      }

      // Get viewBox for dimensions and centering
      const viewBox = svgElement.getAttribute('viewBox') || '0 0 100 100'
      const [vbX, vbY, vbWidth, vbHeight] = viewBox.split(' ').map(Number)

      // Check if it's a real-mm SVG (data-unit="mm")
      const dataUnit = svgElement.getAttribute('data-unit')
      const isRealMm = dataUnit === 'mm'

      // Calculate scale factor: SVG units (mm) -> page units
      const mmToPageUnits = MM_TO_METERS / (this.modelUnitScale * this.pageToModelScale)
      const scale = isRealMm ? mmToPageUnits : (100 * mmToPageUnits) / Math.max(vbWidth, vbHeight)

      // SVG center (for centering at pageX, pageY)
      const svgCenterX = vbX + vbWidth / 2
      const svgCenterY = vbY + vbHeight / 2

      // Rotation in radians
      const radians = (rotation * Math.PI) / 180
      const cos = Math.cos(radians)
      const sin = Math.sin(radians)

      // Helper: transform SVG point to page coordinates (scale, rotate around center, translate)
      const transformPoint = (svgX: number, svgY: number): { x: number; y: number } => {
        // Translate to origin (relative to SVG center)
        const dx = (svgX - svgCenterX) * scale
        const dy = (svgY - svgCenterY) * scale
        // Rotate
        const rx = dx * cos - dy * sin
        const ry = dx * sin + dy * cos
        // Translate to page position
        return { x: pageX + rx, y: pageY + ry }
      }

      // Collect all shapes
      const shapes: Edit2DShape[] = []

      // Process <rect> elements → 4-point Polygon
      svgElement.querySelectorAll('rect').forEach((rect) => {
        const x = parseFloat(rect.getAttribute('x') || '0')
        const y = parseFloat(rect.getAttribute('y') || '0')
        const w = parseFloat(rect.getAttribute('width') || '0')
        const h = parseFloat(rect.getAttribute('height') || '0')
        const stroke = rect.getAttribute('stroke') || '#000000'

        const points = [
          transformPoint(x, y),
          transformPoint(x + w, y),
          transformPoint(x + w, y + h),
          transformPoint(x, y + h),
        ]

        const polygon = new Edit2D.Polygon(points)
        if (polygon.style) {
          polygon.style.lineColor = stroke
          polygon.style.lineWidth = scale * 1.5
          polygon.style.fillAlpha = 0 // No fill for outline shapes
        }
        shapes.push(polygon as Edit2DShape)
      })

      // Process <circle> elements → PolygonPath with ellipse arcs (true circles)
      svgElement.querySelectorAll('circle').forEach((circle) => {
        const cx = parseFloat(circle.getAttribute('cx') || '0')
        const cy = parseFloat(circle.getAttribute('cy') || '0')
        const r = parseFloat(circle.getAttribute('r') || '0')
        const stroke = circle.getAttribute('stroke') || '#000000'

        if (r <= 0) return

        // Transform the two diametrically opposite points (left and right of center)
        const leftPoint = transformPoint(cx - r, cy)
        const rightPoint = transformPoint(cx + r, cy)

        // Create PolygonPath with 2 points
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const polygonPath = new Edit2D.PolygonPath([leftPoint, rightPoint]) as any

        // Calculate scaled radius (after transformation)
        const scaledRadius = r * scale

        // Create arc parameters for the semicircles
        const params = new Edit2D.EllipseArcParams()
        params.rx = scaledRadius
        params.ry = scaledRadius
        params.rotation = rotation // Apply marker rotation to arcs
        params.largeArcFlag = false // Semicircle is not "large"
        params.sweepFlag = true     // Clockwise

        // Apply to both segments (top half and bottom half)
        polygonPath.setEllipseArc(0, params) // Top arc
        polygonPath.setEllipseArc(1, params) // Bottom arc

        if (polygonPath.style) {
          polygonPath.style.lineColor = stroke
          polygonPath.style.lineWidth = scale * 1.5
          polygonPath.style.fillAlpha = 0
        }
        shapes.push(polygonPath as Edit2DShape)
      })

      // Process <line> elements → Polyline (native Edit2D primitive)
      svgElement.querySelectorAll('line').forEach((line) => {
        const x1 = parseFloat(line.getAttribute('x1') || '0')
        const y1 = parseFloat(line.getAttribute('y1') || '0')
        const x2 = parseFloat(line.getAttribute('x2') || '0')
        const y2 = parseFloat(line.getAttribute('y2') || '0')
        const stroke = line.getAttribute('stroke') || '#000000'
        const strokeWidth = parseFloat(line.getAttribute('stroke-width') || '1')

        const points = [
          transformPoint(x1, y1),
          transformPoint(x2, y2),
        ]

        const polyline = new Edit2D.Polyline(points)
        if (polyline.style) {
          polyline.style.lineColor = stroke
          polyline.style.lineWidth = strokeWidth * scale
        }
        shapes.push(polyline as Edit2DShape)
      })

      if (shapes.length === 0) {
        console.warn('[Edit2DMarkers] No shapes extracted from SVG')
        return null
      }

      console.log(`[Edit2DMarkers] Created ${shapes.length} shapes from SVG (${vbWidth}x${vbHeight}mm)`)
      return shapes
    } catch (err) {
      console.error('[Edit2DMarkers] Failed to create shapes from SVG:', err)
      return null
    }
  }

  /**
   * Create a circle shape as fallback marker
   *
   * Uses Edit2D's native PolygonPath with setEllipseArc() for true circles.
   * This gives smooth, geometrically accurate circles instead of polygon approximations.
   *
   * @returns Array with single circle shape, or null on failure
   */
  private createCircleShape(
    pageX: number,
    pageY: number,
    _rotation: number,
    _symbol?: string
  ): Edit2DShape[] | null {
    const Edit2D = window.Autodesk?.Edit2D
    if (!Edit2D?.PolygonPath || !Edit2D?.EllipseArcParams) {
      console.warn('[Edit2DMarkers] Autodesk.Edit2D PolygonPath/EllipseArcParams not available')
      return null
    }

    try {
      // Calculate radius in page units
      const radiusMm = DEFAULT_MARKER_RADIUS_MM
      const mmToPageUnits = MM_TO_METERS / (this.modelUnitScale * this.pageToModelScale)
      const radius = radiusMm * mmToPageUnits

      // Create PolygonPath with 2 diametrically opposite points
      const leftPoint = { x: pageX - radius, y: pageY }
      const rightPoint = { x: pageX + radius, y: pageY }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const polygonPath = new Edit2D.PolygonPath([leftPoint, rightPoint]) as any

      // Create arc parameters for the semicircles
      const params = new Edit2D.EllipseArcParams()
      params.rx = radius
      params.ry = radius
      params.rotation = 0
      params.largeArcFlag = false // Semicircle is not "large"
      params.sweepFlag = true     // Clockwise

      // Apply to both segments (top half and bottom half)
      polygonPath.setEllipseArc(0, params) // Top arc
      polygonPath.setEllipseArc(1, params) // Bottom arc

      // Set style (blue fill with white stroke)
      if (polygonPath.style) {
        polygonPath.style.fillColor = '#3b82f6'
        polygonPath.style.fillAlpha = 1
        polygonPath.style.lineColor = '#ffffff'
        polygonPath.style.lineWidth = radius * 0.15
      }

      return [polygonPath as Edit2DShape]
    } catch (err) {
      console.error('[Edit2DMarkers] Failed to create circle shape:', err)
      return null
    }
  }

  /**
   * Add a text label to a shape
   */
  private addLabelToShape(markerId: string, shape: Edit2DShape, text: string) {
    if (!this.ctx?.layer || !window.Autodesk?.Edit2D?.ShapeLabel) {
      return
    }

    try {
      const label = new window.Autodesk.Edit2D.ShapeLabel(shape, this.ctx.layer)
      label.setText(text)
      this.labels.set(markerId, label)
    } catch (err) {
      console.warn('[Edit2DMarkers] Failed to add label:', err)
    }
  }

  // ============================================================================
  // MARKER OPERATIONS
  // ============================================================================

  /**
   * Select a marker by ID
   */
  selectMarker(id: string | null) {
    if (!this.ctx?.selection) return

    if (id === null) {
      this.ctx.selection.clear()
      this.selectedId = null
      this.callbacks.onSelect?.(null)
      return
    }

    const shapes = this.shapes.get(id)
    if (shapes && shapes.length > 0) {
      // Select the first shape (typically the boundary rect)
      this.ctx.selection.selectOnly(shapes[0])
      this.selectedId = id
      this.callbacks.onSelect?.(id)
    }
  }

  /**
   * Delete a marker by ID
   */
  deleteMarker(id: string) {
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
        // Labels are removed automatically when shape is removed
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
      console.log(`[Edit2DMarkers] Deleted marker: ${id} (${shapes.length} shapes removed)`)
    }
  }

  /**
   * Delete the currently selected marker (for toolbar button)
   */
  deleteSelected() {
    if (this.selectedId) {
      this.deleteMarker(this.selectedId)
    }
  }

  /**
   * Rotate a marker by delta degrees
   *
   * Recreates all shapes with the new rotation angle.
   * This is more reliable than trying to transform existing shapes.
   */
  async rotateMarker(id: string, deltaDegrees: number) {
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
      this.labels.delete(id)
    }

    // Update stored rotation
    data.rotation = newRotation
    this.markerData.set(id, data)

    // Recreate shapes with new rotation
    let newShapes: Edit2DShape[] | null = null
    const fossPid = data.fossPid || data.productName

    if (fossPid) {
      const svgContent = await this.fetchSymbolSvg(fossPid)
      if (svgContent) {
        newShapes = this.createShapeFromSvg(svgContent, data.pageX, data.pageY, newRotation)
      }
    }

    // Fall back to circle if no SVG
    if (!newShapes) {
      newShapes = this.createCircleShape(data.pageX, data.pageY, newRotation, data.symbol)
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
    console.log(`[Edit2DMarkers] Rotated marker ${id} to ${newRotation}°`)
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
  hideSymbolGroup(symbol: string) {
    if (this.hiddenGroups.has(symbol)) return
    if (!this.ctx) return

    this.hiddenGroups.add(symbol)
    let hiddenCount = 0

    for (const [id, data] of this.markerData) {
      if (data.symbol === symbol) {
        const shapes = this.shapes.get(id)
        if (shapes) {
          for (const shape of shapes) {
            this.ctx.removeShape(shape)
          }
          hiddenCount++
        }
      }
    }

    console.log(`[Edit2DMarkers] Hidden symbol ${symbol}: ${hiddenCount} markers`)
  }

  /**
   * Show all markers with the given symbol
   */
  showSymbolGroup(symbol: string) {
    if (!this.hiddenGroups.has(symbol)) return
    if (!this.ctx) return

    this.hiddenGroups.delete(symbol)
    let restoredCount = 0

    for (const [id, data] of this.markerData) {
      if (data.symbol === symbol) {
        const shapes = this.shapes.get(id)
        if (shapes) {
          for (const shape of shapes) {
            this.ctx.addShape(shape)
          }
          restoredCount++
        }
      }
    }

    console.log(`[Edit2DMarkers] Restored symbol ${symbol}: ${restoredCount} markers`)
  }

  /**
   * Apply visibility from a Set of hidden symbols
   */
  applyHiddenGroups(newHiddenGroups: Set<string>) {
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
  clearAll() {
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
  dispose() {
    // Remove keyboard listener (must match capture: true from setup)
    if (this.boundKeyHandler) {
      window.removeEventListener('keydown', this.boundKeyHandler, true)
      this.boundKeyHandler = null
    }

    this.clearAll()
    this.ctx = null
    this.edit2d = null
  }
}
