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
const BADGE_RATIO = 0.35            // Badge size as ratio of marker size

// Supabase storage URL for product symbols
const SYMBOLS_BUCKET_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-symbols`

export interface MarkerData {
  id: string
  productId: string
  projectProductId: string
  productName: string
  fossPid?: string  // FOSS product ID for symbol lookup (e.g., "DT285029320B")
  symbol?: string   // Symbol label (e.g., "A1", "B2") for display
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

  // SVG symbol cache: fossPid -> SVG content (or null if no symbol)
  private svgCache: Map<string, string | null> = new Map()
  // Pending SVG fetches to avoid duplicate requests
  private svgFetchPromises: Map<string, Promise<string | null>> = new Map()

  constructor(viewer: ViewerInstance, minScreenPx: number = DEFAULT_MIN_SCREEN_RADIUS) {
    this.viewer = viewer
    this.minScreenRadius = minScreenPx
  }

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
        // Try the folder-based path first (new format)
        const url = `${SYMBOLS_BUCKET_URL}/${fossPid}/${fossPid}-SYMBOL.svg?t=${Date.now()}`
        const response = await fetch(url)

        if (response.ok) {
          const svgText = await response.text()
          this.svgCache.set(fossPid, svgText)
          return svgText
        }

        // No symbol found
        this.svgCache.set(fossPid, null)
        return null
      } catch (err) {
        console.warn(`[MarkupMarkers] Failed to fetch SVG for ${fossPid}:`, err)
        this.svgCache.set(fossPid, null)
        return null
      } finally {
        this.svgFetchPromises.delete(fossPid)
      }
    })()

    this.svgFetchPromises.set(fossPid, fetchPromise)
    return fetchPromise
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
      const markerType = group.getAttribute('data-marker-type')
      const isSelected = id === this.selectedId
      const displayRadius = isSelected ? radius * 1.4 : radius

      if (markerType === 'svg') {
        // Update SVG marker
        this.updateSvgMarkerSize(group, displayRadius, isSelected)
      } else {
        // Update circle marker
        const circle = group.querySelector('circle')
        const text = group.querySelector('text')

        if (circle) {
          circle.setAttribute('r', String(displayRadius))
          circle.setAttribute('stroke-width', String(strokeWidth))
        }

        if (text) {
          text.setAttribute('font-size', String(fontSize))
        }
      }
    }
  }

  /**
   * Update SVG marker size (symbol, click target, badge)
   */
  private updateSvgMarkerSize(group: SVGElement, radius: number, isSelected: boolean) {
    // Update click target
    const clickTarget = group.querySelector('rect')
    if (clickTarget) {
      clickTarget.setAttribute('x', String(-radius))
      clickTarget.setAttribute('y', String(-radius))
      clickTarget.setAttribute('width', String(radius * 2))
      clickTarget.setAttribute('height', String(radius * 2))
    }

    // Update symbol group transform
    const symbolGroup = group.querySelector('.symbol-content')
    if (symbolGroup) {
      const symbolSize = radius * 2
      const scale = symbolSize / 100  // Assuming 100x100 viewBox
      const offsetX = -(100 * scale) / 2
      const offsetY = -(100 * scale) / 2
      symbolGroup.setAttribute('transform', `translate(${offsetX}, ${-offsetY}) scale(${scale}, ${-scale})`)

      // Add selection highlight (scale up slightly when selected)
      if (isSelected) {
        symbolGroup.setAttribute('transform', `translate(${offsetX * 1.1}, ${-offsetY * 1.1}) scale(${scale * 1.1}, ${-scale * 1.1})`)
      }
    }

    // Update badge
    const badgeGroup = group.querySelector('.symbol-badge')
    if (badgeGroup) {
      const badgeRadius = radius * BADGE_RATIO
      const badgeX = 0
      const badgeY = radius * 0.9  // Top-center (positive Y = up visually)
      badgeGroup.setAttribute('transform', `translate(${badgeX}, ${badgeY})`)

      const badgeCircle = badgeGroup.querySelector('circle')
      if (badgeCircle) {
        badgeCircle.setAttribute('r', String(badgeRadius))
        badgeCircle.setAttribute('stroke-width', String(badgeRadius * 0.2))
        // Change badge fill color based on selection state
        badgeCircle.setAttribute('fill', isSelected ? '#f59e0b' : '#3b82f6')
      }

      const badgeText = badgeGroup.querySelector('text')
      if (badgeText) {
        badgeText.setAttribute('font-size', String(badgeRadius * 1.2))
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

    const svg = this.markupsExt.svg as SVGSVGElement
    const ns = 'http://www.w3.org/2000/svg'

    // Create a group for the marker
    const group = document.createElementNS(ns, 'g')
    group.setAttribute('id', `marker-${markerId}`)
    group.setAttribute('transform', `translate(${markupX}, ${markupY})`)
    group.setAttribute('data-marker-type', 'circle')  // Track marker type for updates
    group.style.cursor = 'pointer'

    // Calculate display radius based on current zoom level
    const radius = this.calculateDisplayRadius()

    // Create initial circle marker (will be replaced with SVG if available)
    this.createCircleMarker(group, radius, data.symbol)

    // Click handler for selection
    group.addEventListener('click', (e) => {
      e.stopPropagation()
      this.selectMarker(markerId)
    })

    svg.appendChild(group)

    // Store references
    this.markers.set(markerId, group)
    this.markerData.set(markerId, markerData)

    // Try to load SVG symbol asynchronously
    const fossPid = data.fossPid || data.productName
    if (fossPid) {
      this.fetchSymbolSvg(fossPid).then((svgContent) => {
        if (svgContent && this.markers.has(markerId)) {
          this.upgradeToSvgMarker(markerId, svgContent, data.symbol)
        }
      })
    }

    console.log('[MarkupMarkers] Added marker:', markerId, 'at markup coords:', markupX, markupY)
    return markerData
  }

  /**
   * Clear all children from an SVG element (safe alternative to innerHTML = '')
   */
  private clearSvgElement(element: SVGElement) {
    while (element.firstChild) {
      element.removeChild(element.firstChild)
    }
  }

  /**
   * Create a circle marker (fallback when no SVG symbol)
   */
  private createCircleMarker(group: SVGElement, radius: number, symbol?: string) {
    const ns = 'http://www.w3.org/2000/svg'
    const label = symbol || '?'
    const strokeWidth = radius * STROKE_RATIO
    const fontSize = radius * FONT_RATIO

    // Clear existing content safely
    this.clearSvgElement(group)

    // Main circle
    const circle = document.createElementNS(ns, 'circle')
    circle.setAttribute('cx', '0')
    circle.setAttribute('cy', '0')
    circle.setAttribute('r', String(radius))
    circle.setAttribute('fill', '#3b82f6')
    circle.setAttribute('stroke', '#ffffff')
    circle.setAttribute('stroke-width', String(strokeWidth))
    circle.style.pointerEvents = 'auto'

    // Label text (flipped for DWG Y-up coordinate system)
    const text = document.createElementNS(ns, 'text')
    text.setAttribute('x', '0')
    text.setAttribute('y', '0')
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'central')
    text.setAttribute('fill', '#ffffff')
    text.setAttribute('font-size', String(fontSize))
    text.setAttribute('font-weight', 'bold')
    text.setAttribute('font-family', 'ui-monospace, monospace')
    text.setAttribute('transform', 'scale(1, -1)')
    text.style.pointerEvents = 'none'
    text.textContent = label

    group.appendChild(circle)
    group.appendChild(text)
    group.setAttribute('data-marker-type', 'circle')
  }

  /**
   * Upgrade a circle marker to SVG symbol with badge
   */
  private upgradeToSvgMarker(markerId: string, svgContent: string, symbol?: string) {
    const group = this.markers.get(markerId)
    if (!group) return

    const ns = 'http://www.w3.org/2000/svg'
    const radius = this.calculateDisplayRadius()
    const label = symbol || '?'

    // Parse the SVG content using DOMParser (safe)
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml')
    const originalSvg = svgDoc.querySelector('svg')

    if (!originalSvg) {
      // Fallback to circle if SVG parsing fails
      this.createCircleMarker(group, radius, symbol)
      return
    }

    // Clear existing content safely
    this.clearSvgElement(group)

    // Create a container group for the symbol
    const symbolGroup = document.createElementNS(ns, 'g')
    symbolGroup.setAttribute('class', 'symbol-content')

    // Get viewBox to calculate proper scaling
    const viewBox = originalSvg.getAttribute('viewBox') || '0 0 100 100'
    const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number)

    // Scale factor: fit symbol within radius * 2 (diameter)
    // Symbol SVG is typically 100x100 viewBox, we want it to fit in 2*radius
    const symbolSize = radius * 2
    const scale = symbolSize / Math.max(vbWidth, vbHeight)

    // Center the symbol (offset by half the scaled size)
    const offsetX = -(vbWidth * scale) / 2
    const offsetY = -(vbHeight * scale) / 2

    // Apply transform: translate to center, then scale
    // Note: DWG Y-axis is up, so we flip Y
    symbolGroup.setAttribute('transform', `translate(${offsetX}, ${-offsetY}) scale(${scale}, ${-scale})`)

    // Copy all children from the original SVG (safe DOM cloning)
    Array.from(originalSvg.children).forEach((child) => {
      const cloned = child.cloneNode(true) as SVGElement
      symbolGroup.appendChild(cloned)
    })

    // Create a click target (invisible rect covering the symbol area)
    const clickTarget = document.createElementNS(ns, 'rect')
    clickTarget.setAttribute('x', String(-radius))
    clickTarget.setAttribute('y', String(-radius))
    clickTarget.setAttribute('width', String(radius * 2))
    clickTarget.setAttribute('height', String(radius * 2))
    clickTarget.setAttribute('fill', 'transparent')
    clickTarget.style.pointerEvents = 'auto'

    // Create badge with symbol letter
    const badgeGroup = this.createBadge(radius, label)

    // Add elements to group
    group.appendChild(clickTarget)
    group.appendChild(symbolGroup)
    group.appendChild(badgeGroup)
    group.setAttribute('data-marker-type', 'svg')

    console.log('[MarkupMarkers] Upgraded marker to SVG:', markerId)
  }

  /**
   * Create a badge with the symbol letter
   */
  private createBadge(markerRadius: number, label: string): SVGElement {
    const ns = 'http://www.w3.org/2000/svg'
    const badgeRadius = markerRadius * BADGE_RATIO
    const fontSize = badgeRadius * 1.2

    // Position badge at top-center of marker
    const badgeX = 0
    const badgeY = markerRadius * 0.9  // Positive Y = up visually in markup coords

    const badgeGroup = document.createElementNS(ns, 'g')
    badgeGroup.setAttribute('class', 'symbol-badge')
    badgeGroup.setAttribute('transform', `translate(${badgeX}, ${badgeY})`)

    // Badge circle (blue with white border)
    const circle = document.createElementNS(ns, 'circle')
    circle.setAttribute('cx', '0')
    circle.setAttribute('cy', '0')
    circle.setAttribute('r', String(badgeRadius))
    circle.setAttribute('fill', '#3b82f6')
    circle.setAttribute('stroke', '#ffffff')
    circle.setAttribute('stroke-width', String(badgeRadius * 0.2))

    // Badge text
    const text = document.createElementNS(ns, 'text')
    text.setAttribute('x', '0')
    text.setAttribute('y', '0')
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'central')
    text.setAttribute('fill', '#ffffff')
    text.setAttribute('font-size', String(fontSize))
    text.setAttribute('font-weight', 'bold')
    text.setAttribute('font-family', 'ui-monospace, monospace')
    text.setAttribute('transform', 'scale(1, -1)')  // Flip for DWG coords
    text.style.pointerEvents = 'none'
    text.textContent = label

    badgeGroup.appendChild(circle)
    badgeGroup.appendChild(text)

    return badgeGroup
  }

  /**
   * Select a marker
   */
  selectMarker(id: string | null) {
    const radius = this.calculateDisplayRadius()
    const strokeWidth = radius * STROKE_RATIO

    // Deselect previous
    if (this.selectedId) {
      const prevMarker = this.markers.get(this.selectedId)
      if (prevMarker) {
        const markerType = prevMarker.getAttribute('data-marker-type')

        if (markerType === 'svg') {
          // Update SVG marker to deselected state
          this.updateSvgMarkerSize(prevMarker, radius, false)
        } else {
          // Circle marker: reset fill and size
          const circle = prevMarker.querySelector('circle')
          if (circle) {
            circle.setAttribute('fill', '#3b82f6')
            circle.setAttribute('r', String(radius))
            circle.setAttribute('stroke-width', String(strokeWidth))
          }
        }
      }
    }

    this.selectedId = id

    // Select new
    if (id) {
      const marker = this.markers.get(id)
      if (marker) {
        const markerType = marker.getAttribute('data-marker-type')

        if (markerType === 'svg') {
          // Update SVG marker to selected state
          this.updateSvgMarkerSize(marker, radius * 1.4, true)
        } else {
          // Circle marker: highlight with amber fill and increased size
          const circle = marker.querySelector('circle')
          if (circle) {
            circle.setAttribute('fill', '#f59e0b')
            circle.setAttribute('r', String(radius * 1.4))
            circle.setAttribute('stroke-width', String(strokeWidth * 1.4))
          }
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
