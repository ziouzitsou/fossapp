/**
 * MarkupMarkers - Product placement using MarkupsCore SVG layer
 *
 * Uses the MarkupsCore extension's SVG layer for markers.
 * Key advantage: zoom/pan tracking is handled automatically by the extension.
 *
 * Coordinate flow:
 * 1. Click event gives screen coordinates (clientX, clientY)
 * 2. clientToMarkups() converts to markup space coordinates
 * 3. SVG circle is placed at markup coordinates
 * 4. MarkupsCore handles all zoom/pan transformations
 *
 * Marker sizing:
 * - Real-world size: 50mm radius (100mm diameter)
 * - Minimum screen size: 12px radius (so markers stay visible when zoomed out)
 * - Dynamic adjustment on zoom changes via CAMERA_CHANGE_EVENT
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ViewerInstance = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MarkupsCoreExt = any

// Marker sizing constants
const REAL_WORLD_RADIUS = 0.05      // 50mm in meters (100mm diameter)
const DEFAULT_MIN_SCREEN_RADIUS = 12  // Default minimum pixels on screen
const STROKE_RATIO = 0.2            // Stroke width as ratio of radius
const FONT_RATIO = 0.8              // Font size as ratio of radius

export interface MarkerData {
  id: string
  productId: string
  projectProductId: string
  productName: string
  symbol?: string  // Symbol label (e.g., "A1", "B2") for display
  // Markup space coordinates (not world coords!)
  markupX: number
  markupY: number
}

export class MarkupMarkers {
  private viewer: ViewerInstance
  private markupsExt: MarkupsCoreExt | null = null
  private markers: Map<string, SVGElement> = new Map()
  private markerData: Map<string, MarkerData> = new Map()
  private selectedId: string | null = null
  private onSelect: ((id: string | null) => void) | null = null
  private onDelete: ((id: string) => void) | null = null
  private minScreenRadius: number

  constructor(viewer: ViewerInstance, minScreenPx: number = DEFAULT_MIN_SCREEN_RADIUS) {
    this.viewer = viewer
    this.minScreenRadius = minScreenPx
  }

  // Bound handlers for cleanup
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null
  private boundCameraHandler: (() => void) | null = null

  /**
   * Initialize - must be called after viewer is ready
   */
  async initialize(): Promise<boolean> {
    try {
      this.markupsExt = this.viewer.getExtension('Autodesk.Viewing.MarkupsCore')
      if (!this.markupsExt) {
        console.error('[MarkupMarkers] MarkupsCore extension not loaded')
        return false
      }

      // Enter edit mode to enable the SVG layer, then leave
      // This initializes the SVG container
      this.markupsExt.enterEditMode()
      this.markupsExt.leaveEditMode()

      // Show the markup layer
      this.markupsExt.show()

      // Add keyboard listener for Delete key
      this.boundKeyHandler = this.handleKeyDown.bind(this)
      window.addEventListener('keydown', this.boundKeyHandler)

      // Add camera change listener for dynamic marker sizing
      this.boundCameraHandler = this.handleCameraChange.bind(this)
      this.viewer.addEventListener(
        window.Autodesk.Viewing.CAMERA_CHANGE_EVENT,
        this.boundCameraHandler
      )

      console.log('[MarkupMarkers] Initialized successfully')
      return true
    } catch (err) {
      console.error('[MarkupMarkers] Failed to initialize:', err)
      return false
    }
  }

  /**
   * Handle camera/zoom changes - update marker sizes
   */
  private handleCameraChange() {
    this.updateMarkerSizes()
  }

  /**
   * Get current pixels-per-meter scale from SVG CTM
   */
  private getPixelsPerMeter(): number {
    if (!this.markupsExt?.svg) return 1

    const svg = this.markupsExt.svg as SVGSVGElement
    const ctm = svg.getScreenCTM()
    if (!ctm) return 1

    // CTM.a is the scale factor (pixels per SVG unit, which is meters)
    return Math.abs(ctm.a)
  }

  /**
   * Calculate the display radius based on current zoom level
   * Returns radius in SVG/world units (meters)
   */
  private calculateDisplayRadius(): number {
    const pixelsPerMeter = this.getPixelsPerMeter()
    const realWorldScreenSize = REAL_WORLD_RADIUS * pixelsPerMeter

    if (realWorldScreenSize < this.minScreenRadius) {
      // Clamp to minimum screen size
      return this.minScreenRadius / pixelsPerMeter
    }

    // Use real-world size
    return REAL_WORLD_RADIUS
  }

  /**
   * Update all marker sizes based on current zoom level
   */
  private updateMarkerSizes() {
    const radius = this.calculateDisplayRadius()
    const strokeWidth = radius * STROKE_RATIO
    const fontSize = radius * FONT_RATIO

    for (const [id, group] of this.markers) {
      const circle = group.querySelector('circle')
      const text = group.querySelector('text')

      if (circle) {
        // Adjust for selected state
        const isSelected = id === this.selectedId
        const displayRadius = isSelected ? radius * 1.4 : radius

        circle.setAttribute('r', String(displayRadius))
        circle.setAttribute('stroke-width', String(strokeWidth))
      }

      if (text) {
        text.setAttribute('font-size', String(fontSize))
      }
    }
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(e: KeyboardEvent) {
    // Don't handle if user is typing in an input
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    if (this.selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()
      this.deleteSelected()
    }
  }

  /**
   * Set callbacks for marker events
   */
  setCallbacks(
    onSelect: (id: string | null) => void,
    onDelete: (id: string) => void
  ) {
    this.onSelect = onSelect
    this.onDelete = onDelete
  }

  /**
   * Convert screen coordinates to markup coordinates
   *
   * Uses SVG's built-in getScreenCTM() for accurate coordinate transformation.
   * This properly handles aspect ratio preservation and all SVG transforms.
   */
  screenToMarkup(screenX: number, screenY: number): { x: number; y: number } | null {
    if (!this.markupsExt?.svg) return null

    try {
      const svg = this.markupsExt.svg as SVGSVGElement

      // Use SVG's built-in coordinate transformation
      const svgPoint = svg.createSVGPoint()
      svgPoint.x = screenX
      svgPoint.y = screenY

      // Get the screen-to-SVG transformation matrix
      const ctm = svg.getScreenCTM()
      if (!ctm) {
        console.warn('[MarkupMarkers] getScreenCTM returned null')
        return null
      }

      // Apply inverse transformation to convert screen coords to SVG coords
      const inverseCtm = ctm.inverse()
      const transformedPoint = svgPoint.matrixTransform(inverseCtm)

      return { x: transformedPoint.x, y: transformedPoint.y }
    } catch (err) {
      console.error('[MarkupMarkers] screenToMarkup failed:', err)
      return null
    }
  }

  /**
   * Convert world coordinates (viewer space) to markup coordinates
   *
   * This is more accurate than screen conversion, especially with snapping.
   * Uses viewer's worldToClient then SVG's getScreenCTM for proper transformation.
   */
  worldToMarkup(worldX: number, worldY: number, worldZ: number = 0): { x: number; y: number } | null {
    if (!this.markupsExt?.svg) return null

    try {
      // Convert world to client (viewport-relative) coordinates
      // THREE.js is loaded globally by the Autodesk viewer at runtime
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const THREE = (window as any).THREE
      const worldPoint = new THREE.Vector3(worldX, worldY, worldZ)
      const clientPoint = this.viewer.worldToClient(worldPoint)

      if (!clientPoint) {
        console.warn('[MarkupMarkers] worldToClient returned null')
        return null
      }

      // worldToClient returns coordinates relative to the viewer canvas
      // We need to convert to screen coordinates for SVG transformation
      const container = this.viewer.container as HTMLElement
      const rect = container.getBoundingClientRect()

      const screenX = rect.left + clientPoint.x
      const screenY = rect.top + clientPoint.y

      // Use the same SVG transformation as screenToMarkup
      return this.screenToMarkup(screenX, screenY)
    } catch (err) {
      console.error('[MarkupMarkers] worldToMarkup failed:', err)
      return null
    }
  }

  /**
   * Add a marker at world coordinates (DWG model space)
   * More accurate than screen coordinates, especially with snapping.
   */
  addMarkerAtWorld(
    worldX: number,
    worldY: number,
    worldZ: number,
    data: Omit<MarkerData, 'id' | 'markupX' | 'markupY'>,
    id?: string
  ): MarkerData | null {
    const markupCoords = this.worldToMarkup(worldX, worldY, worldZ)
    if (!markupCoords) {
      // Fallback: try screen coordinates if world conversion fails
      console.warn('[MarkupMarkers] worldToMarkup failed, marker not placed')
      return null
    }

    return this.addMarkerAtMarkup(markupCoords.x, markupCoords.y, data, id)
  }

  /**
   * Add a marker at screen coordinates
   * @param id - Optional external ID (if not provided, generates UUID)
   */
  addMarkerAtScreen(
    screenX: number,
    screenY: number,
    data: Omit<MarkerData, 'id' | 'markupX' | 'markupY'>,
    id?: string
  ): MarkerData | null {
    const markupCoords = this.screenToMarkup(screenX, screenY)
    if (!markupCoords) return null

    return this.addMarkerAtMarkup(markupCoords.x, markupCoords.y, data, id)
  }

  /**
   * Add a marker at markup coordinates
   * @param id - Optional external ID (if not provided, generates UUID)
   */
  addMarkerAtMarkup(
    markupX: number,
    markupY: number,
    data: Omit<MarkerData, 'id' | 'markupX' | 'markupY'>,
    id?: string
  ): MarkerData | null {
    if (!this.markupsExt?.svg) {
      console.error('[MarkupMarkers] SVG layer not available')
      return null
    }

    const markerId = id || crypto.randomUUID()
    const markerData: MarkerData = {
      ...data,
      id: markerId,
      markupX,
      markupY,
    }

    // Create SVG circle marker
    const svg = this.markupsExt.svg as SVGSVGElement
    const ns = 'http://www.w3.org/2000/svg'

    // Create a group for the marker (circle + optional label)
    const group = document.createElementNS(ns, 'g')
    group.setAttribute('id', `marker-${markerId}`)
    group.setAttribute('transform', `translate(${markupX}, ${markupY})`)
    group.style.cursor = 'pointer'

    // Determine label - use symbol if available, otherwise first letter
    const label = data.symbol || data.productName.charAt(0).toUpperCase()

    // Calculate display radius based on current zoom level
    const radius = this.calculateDisplayRadius()
    const strokeWidth = radius * STROKE_RATIO
    const fontSize = radius * FONT_RATIO

    // Main circle
    const circle = document.createElementNS(ns, 'circle')
    circle.setAttribute('cx', '0')
    circle.setAttribute('cy', '0')
    circle.setAttribute('r', String(radius))
    circle.setAttribute('fill', '#3b82f6')
    circle.setAttribute('stroke', '#ffffff')
    circle.setAttribute('stroke-width', String(strokeWidth))
    circle.style.pointerEvents = 'auto'

    // Label (symbol or first letter)
    // Note: DWG coordinate system has Y pointing up, SVG has Y pointing down
    // We need to flip the text vertically so it appears right-side up
    const text = document.createElementNS(ns, 'text')
    text.setAttribute('x', '0')
    text.setAttribute('y', '0')
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'central')
    text.setAttribute('fill', '#ffffff')
    text.setAttribute('font-size', String(fontSize))
    text.setAttribute('font-weight', 'bold')
    text.setAttribute('font-family', 'ui-monospace, monospace')
    text.setAttribute('transform', 'scale(1, -1)')  // Mirror Y-axis for DWG coordinate system
    text.style.pointerEvents = 'none'
    text.textContent = label

    group.appendChild(circle)
    group.appendChild(text)

    // Click handler for selection
    group.addEventListener('click', (e) => {
      e.stopPropagation()
      this.selectMarker(markerId)
    })

    svg.appendChild(group)

    // Store references
    this.markers.set(markerId, group)
    this.markerData.set(markerId, markerData)

    console.log('[MarkupMarkers] Added marker:', markerId, 'at markup coords:', markupX, markupY)
    return markerData
  }

  /**
   * Select a marker
   */
  selectMarker(id: string | null) {
    const radius = this.calculateDisplayRadius()

    // Deselect previous
    if (this.selectedId) {
      const prevMarker = this.markers.get(this.selectedId)
      if (prevMarker) {
        const circle = prevMarker.querySelector('circle')
        if (circle) {
          circle.setAttribute('fill', '#3b82f6')
          circle.setAttribute('r', String(radius))
        }
      }
    }

    this.selectedId = id

    // Select new
    if (id) {
      const marker = this.markers.get(id)
      if (marker) {
        const circle = marker.querySelector('circle')
        if (circle) {
          circle.setAttribute('fill', '#f59e0b')
          // Increase radius by 40% for selection highlight
          circle.setAttribute('r', String(radius * 1.4))
        }
      }
    }

    this.onSelect?.(id)
  }

  /**
   * Delete a marker
   */
  deleteMarker(id: string) {
    const marker = this.markers.get(id)
    if (marker) {
      marker.remove()
      this.markers.delete(id)
      this.markerData.delete(id)

      if (this.selectedId === id) {
        this.selectedId = null
        this.onSelect?.(null)
      }

      this.onDelete?.(id)
      console.log('[MarkupMarkers] Deleted marker:', id)
    }
  }

  /**
   * Delete selected marker
   */
  deleteSelected() {
    if (this.selectedId) {
      this.deleteMarker(this.selectedId)
    }
  }

  /**
   * Get all marker data
   */
  getAllMarkers(): MarkerData[] {
    return Array.from(this.markerData.values())
  }

  /**
   * Clear all markers
   */
  clearAll() {
    for (const [id, marker] of this.markers) {
      marker.remove()
    }
    this.markers.clear()
    this.markerData.clear()
    this.selectedId = null
  }

  /**
   * Cleanup
   */
  dispose() {
    // Remove keyboard listener
    if (this.boundKeyHandler) {
      window.removeEventListener('keydown', this.boundKeyHandler)
      this.boundKeyHandler = null
    }

    // Remove camera change listener
    if (this.boundCameraHandler && this.viewer) {
      this.viewer.removeEventListener(
        window.Autodesk.Viewing.CAMERA_CHANGE_EVENT,
        this.boundCameraHandler
      )
      this.boundCameraHandler = null
    }

    this.clearAll()
    this.markupsExt = null
  }
}
