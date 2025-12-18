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
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ViewerInstance = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MarkupsCoreExt = any

export interface MarkerData {
  id: string
  productId: string
  projectProductId: string
  productName: string
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

  constructor(viewer: ViewerInstance) {
    this.viewer = viewer
  }

  // Bound keyboard handler for cleanup
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null

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

      console.log('[MarkupMarkers] Initialized successfully')
      return true
    } catch (err) {
      console.error('[MarkupMarkers] Failed to initialize:', err)
      return false
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
   * The MarkupsCore SVG layer has transform: scale(1, -1) which flips Y axis.
   * We manually calculate coordinates to match the click position.
   */
  screenToMarkup(screenX: number, screenY: number): { x: number; y: number } | null {
    if (!this.markupsExt?.svg) return null

    try {
      const container = this.viewer.container as HTMLElement
      const rect = container.getBoundingClientRect()

      // Get SVG viewBox
      const svg = this.markupsExt.svg as SVGSVGElement
      const viewBox = svg.viewBox.baseVal

      // Click position relative to container
      const localX = screenX - rect.left
      const localY = screenY - rect.top

      // Convert to viewBox coordinates
      // Note: SVG has scale(1, -1) transform, so Y is flipped around center
      const scaleX = viewBox.width / rect.width
      const scaleY = viewBox.height / rect.height

      const markupX = viewBox.x + localX * scaleX
      // For Y: convert to viewBox space, then flip around center
      const rawY = viewBox.y + localY * scaleY
      const centerY = viewBox.y + viewBox.height / 2
      const markupY = 2 * centerY - rawY  // Flip around center

      return { x: markupX, y: markupY }
    } catch (err) {
      console.error('[MarkupMarkers] screenToMarkup failed:', err)
      return null
    }
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

    // Main circle
    const circle = document.createElementNS(ns, 'circle')
    circle.setAttribute('cx', '0')
    circle.setAttribute('cy', '0')
    circle.setAttribute('r', '12')
    circle.setAttribute('fill', '#3b82f6')
    circle.setAttribute('stroke', '#ffffff')
    circle.setAttribute('stroke-width', '2')
    circle.style.pointerEvents = 'auto'

    // Label (first letter of product name)
    const text = document.createElementNS(ns, 'text')
    text.setAttribute('x', '0')
    text.setAttribute('y', '0')
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'central')
    text.setAttribute('fill', '#ffffff')
    text.setAttribute('font-size', '10')
    text.setAttribute('font-weight', 'bold')
    text.style.pointerEvents = 'none'
    text.textContent = data.productName.charAt(0).toUpperCase()

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
    // Deselect previous
    if (this.selectedId) {
      const prevMarker = this.markers.get(this.selectedId)
      if (prevMarker) {
        const circle = prevMarker.querySelector('circle')
        if (circle) {
          circle.setAttribute('fill', '#3b82f6')
          circle.setAttribute('r', '12')
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
          circle.setAttribute('r', '14')
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
    this.clearAll()
    this.markupsExt = null
  }
}
