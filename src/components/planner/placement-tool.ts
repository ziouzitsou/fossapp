/**
 * PlacementTool handles click-to-place interactions within the Autodesk Viewer.
 * It allows clicking to place markers while passing drag/scroll events
 * through to the default navigation tools (Pan/Zoom).
 *
 * COORDINATE SYSTEM (2D DWGs):
 * ───────────────────────────
 * APS Viewer uses a 2-stage coordinate system for 2D DWGs:
 *   Screen coords → Page coords → DWG model coords
 *
 * This tool outputs PAGE coordinates (viewer's internal system).
 * The consumer (planner-viewer.tsx) must convert to DWG model coords
 * using model.getPageToModelTransform(1) for storage/export.
 *
 * See: https://aps.autodesk.com/blog/parsing-line-points-viewer
 *
 * Features:
 * - Snapping to geometry (vertices, midpoints, intersections, edges)
 * - Uses Autodesk.Snapping extension for proper snap detection
 * - Screen coordinates for MarkupsCore SVG layer
 *
 * Based on: https://aps.autodesk.com/blog/snappy-viewer-tools
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ViewerInstance = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Snapper = any

export interface PlacementCoords {
  // Page coordinates (viewer's internal coordinate system for 2D DWGs)
  // Consumer must convert to DWG coords using getPageToModelTransform(1)
  worldX: number  // Actually page X - named 'world' for API compatibility
  worldY: number  // Actually page Y - named 'world' for API compatibility
  worldZ: number  // Z coordinate (usually 0 for 2D)
  // Screen coordinates (for MarkupsCore SVG layer positioning)
  screenX: number
  screenY: number
  // Whether coordinates are snapped to geometry
  isSnapped: boolean
  // Snap type if snapped ('vertex', 'edge', 'midpoint', etc.)
  snapType?: string
}

export interface SnapState {
  isSnapped: boolean
  worldX: number  // Page X coordinate (from snapper)
  worldY: number  // Page Y coordinate (from snapper)
  snapType?: string // 'vertex', 'edge', 'midpoint', 'intersection', etc.
}

/**
 * Coordinates reported for display (converted to DWG by consumer)
 * Named "Dwg" because planner-viewer converts page→DWG before display
 */
export interface DwgCoordinates {
  x: number       // Page X (consumer converts to DWG)
  y: number       // Page Y (consumer converts to DWG)
  isSnapped: boolean
  snapType?: string
}

// Snap type constants from Autodesk.Viewing.MeasureCommon.SnapType
const SnapType = {
  SNAP_VERTEX: 1,
  SNAP_MIDPOINT: 2,
  SNAP_INTERSECTION: 3,
  SNAP_CIRCLE_CENTER: 4,
  SNAP_EDGE: 5,
  SNAP_CIRCULARARC: 6,
  SNAP_CURVEDEDGE: 7,
  SNAP_FACE: 8,
}

function getSnapTypeName(geomType: number): string {
  switch (geomType) {
    case SnapType.SNAP_VERTEX: return 'vertex'
    case SnapType.SNAP_MIDPOINT: return 'midpoint'
    case SnapType.SNAP_INTERSECTION: return 'intersection'
    case SnapType.SNAP_CIRCLE_CENTER: return 'center'
    case SnapType.SNAP_EDGE: return 'edge'
    case SnapType.SNAP_CIRCULARARC: return 'arc'
    case SnapType.SNAP_CURVEDEDGE: return 'curve'
    case SnapType.SNAP_FACE: return 'face'
    default: return 'point'
  }
}

export class PlacementTool {
  private viewer: ViewerInstance
  private onPlacement: (coords: PlacementCoords) => void
  private onSnapChange?: (state: SnapState | null) => void
  private onCoordinateChange?: (coords: DwgCoordinates | null) => void
  private names: string[] = ['placement-tool']
  private snapper: Snapper | null = null
  private snapperRegistered: boolean = false
  private lastSnapState: SnapState | null = null
  private snappingEnabled: boolean = true

  constructor(
    viewer: ViewerInstance,
    onPlacement: (coords: PlacementCoords) => void,
    onSnapChange?: (state: SnapState | null) => void,
    onCoordinateChange?: (coords: DwgCoordinates | null) => void
  ) {
    this.viewer = viewer
    this.onPlacement = onPlacement
    this.onSnapChange = onSnapChange
    this.onCoordinateChange = onCoordinateChange
  }

  getNames() { return this.names }
  getName() { return this.names[0] }

  /**
   * Enable or disable snapping
   */
  setSnappingEnabled(enabled: boolean) {
    this.snappingEnabled = enabled
    if (!enabled) {
      // Deactivate snapper and clear indicator
      if (this.snapper && this.snapperRegistered) {
        this.viewer.toolController.deactivateTool(this.snapper.getName())
        this.snapper.indicator?.clearOverlays()
      }
      if (this.lastSnapState) {
        this.lastSnapState = null
        this.onSnapChange?.(null)
      }
    } else if (this.snapper && this.snapperRegistered) {
      // Reactivate snapper
      this.viewer.toolController.activateTool(this.snapper.getName())
    }
  }

  isSnappingEnabled() {
    return this.snappingEnabled
  }

  activate() {
    if (this.viewer.canvas) {
      this.viewer.canvas.style.cursor = 'crosshair'
    }

    // Use the existing snapper from the tool stack (loaded by Autodesk.Snapping extension)
    this.initializeSnapper()
  }

  /**
   * Initialize snapper by using the existing snapper from the tool stack
   * The viewer already has a 'snapper' tool registered - we just need to activate it
   */
  private initializeSnapper() {
    try {
      const tc = this.viewer.toolController

      // First, ensure Autodesk.Snapping extension is loaded
      // This registers the 'snapper' tool on the tool stack
      const snappingExt = this.viewer.getExtension('Autodesk.Snapping')
      if (!snappingExt) {
        // Load it synchronously if not already loaded
        this.viewer.loadExtension('Autodesk.Snapping').then(() => {
          this.activateExistingSnapper()
        }).catch((err: Error) => {
          console.warn('[PlacementTool] Failed to load Snapping extension:', err)
        })
        return
      }

      this.activateExistingSnapper()
    } catch (err) {
      console.error('[PlacementTool] Failed to initialize snapper:', err)
    }
  }

  /**
   * Activate the existing snapper tool from the tool stack
   */
  private activateExistingSnapper() {
    try {
      const tc = this.viewer.toolController

      // Activate the existing snapper tool
      tc.activateTool('snapper')

      // Get reference to the snapper for querying snap results
      this.snapper = tc.getTool('snapper')
      this.snapperRegistered = true

      if (this.snapper) {
        console.log('[PlacementTool] Using existing snapper from tool stack, isActive:', this.snapper.isActive?.())
      } else {
        console.warn('[PlacementTool] Snapper tool not found in tool stack')
      }
    } catch (err) {
      console.error('[PlacementTool] Failed to activate snapper:', err)
    }
  }

  deactivate() {
    if (this.viewer.canvas) {
      this.viewer.canvas.style.cursor = ''
    }

    // Clear snapper indicator but don't deactivate (other tools might use it)
    if (this.snapper) {
      try {
        this.snapper.indicator?.clearOverlays()
      } catch (err) {
        console.warn('[PlacementTool] Error clearing snapper indicator:', err)
      }
    }

    this.snapper = null
    this.snapperRegistered = false
    this.lastSnapState = null
    this.onSnapChange?.(null)
  }

  /**
   * handleMouseMove - detect snap points and report page coordinates as mouse moves.
   * The snapper handles detection internally; we check isSnapped and render the indicator.
   * Reports page coordinates via onCoordinateChange (consumer converts to DWG for display).
   * Returns false to allow pan/zoom tools to also receive the event.
   */
  handleMouseMove(event: MouseEvent): boolean {
    let viewerX: number | undefined
    let viewerY: number | undefined
    let isSnapped = false
    let snapType: string | undefined

    // Handle snapping if enabled
    if (this.snapper && this.snappingEnabled) {
      // Clear previous indicator
      this.snapper.indicator?.clearOverlays()

      // Check if snapper detected a snap point
      if (this.snapper.isSnapped()) {
        const result = this.snapper.getSnapResult()

        // Render visual indicator for the snap
        this.snapper.indicator?.render()

        if (result?.geomVertex) {
          const snapX = result.geomVertex.x
          const snapY = result.geomVertex.y
          viewerX = snapX
          viewerY = snapY
          isSnapped = true
          snapType = getSnapTypeName(result.geomType)

          const snapState: SnapState = {
            isSnapped: true,
            worldX: snapX,
            worldY: snapY,
            snapType,
          }

          // Only notify if snap state changed
          if (!this.lastSnapState ||
              this.lastSnapState.worldX !== snapState.worldX ||
              this.lastSnapState.worldY !== snapState.worldY) {
            this.lastSnapState = snapState
            this.onSnapChange?.(snapState)
          }
        } else if (result?.intersectPoint) {
          const snapX = result.intersectPoint.x
          const snapY = result.intersectPoint.y
          viewerX = snapX
          viewerY = snapY
          isSnapped = true
          snapType = 'intersection'

          const snapState: SnapState = {
            isSnapped: true,
            worldX: snapX,
            worldY: snapY,
            snapType,
          }

          if (!this.lastSnapState ||
              this.lastSnapState.worldX !== snapState.worldX ||
              this.lastSnapState.worldY !== snapState.worldY) {
            this.lastSnapState = snapState
            this.onSnapChange?.(snapState)
          }
        }
      } else {
        // No snap - clear snap state
        if (this.lastSnapState) {
          this.lastSnapState = null
          this.onSnapChange?.(null)
        }
      }
    }

    // If no snap, calculate page coordinates from mouse position
    // Note: clientToWorld() is unreliable for 2D DWGs, so we always use visible bounds
    if (viewerX === undefined || viewerY === undefined) {
      const impl = this.viewer.impl
      const visibleBounds = impl?.getVisibleBounds?.()
      if (visibleBounds) {
        const container = this.viewer.container
        const rect = container.getBoundingClientRect()
        const localX = event.clientX - rect.left
        const localY = event.clientY - rect.top
        const visWidth = visibleBounds.max.x - visibleBounds.min.x
        const visHeight = visibleBounds.max.y - visibleBounds.min.y
        // Page coords: X increases right, Y increases up (flip from screen)
        viewerX = visibleBounds.min.x + (localX / rect.width) * visWidth
        viewerY = visibleBounds.max.y - (localY / rect.height) * visHeight
      }
    }

    // Report page coordinates (consumer converts to DWG for display)
    if (viewerX !== undefined && viewerY !== undefined && this.onCoordinateChange) {
      this.onCoordinateChange({ x: viewerX, y: viewerY, isSnapped, snapType })
    }

    return false // Allow pan/zoom to also handle the event
  }

  /**
   * handleSingleClick - place marker at clicked position.
   * Uses snapped coordinates if available, otherwise calculates from visible bounds.
   * Returns page coordinates via onPlacement callback.
   * Consumer must convert to DWG coords using getPageToModelTransform(1) for storage.
   */
  handleSingleClick(event: MouseEvent, button: number): boolean {
    if (button !== 0) return false // Only handle left clicks

    const screenX = event.clientX
    const screenY = event.clientY

    let viewerX: number
    let viewerY: number
    let viewerZ = 0
    let isSnapped = false
    let snapType: string | undefined

    // First, check if we have a snap
    if (this.snapper && this.snappingEnabled && this.snapper.isSnapped()) {
      const result = this.snapper.getSnapResult()

      if (result?.geomVertex) {
        viewerX = result.geomVertex.x
        viewerY = result.geomVertex.y
        viewerZ = result.geomVertex.z || 0
        isSnapped = true
        snapType = getSnapTypeName(result.geomType)
      } else if (result?.intersectPoint) {
        viewerX = result.intersectPoint.x
        viewerY = result.intersectPoint.y
        viewerZ = result.intersectPoint.z || 0
        isSnapped = true
        snapType = 'intersection'
      }
    }

    // If no snap, calculate page coordinates manually
    // Note: clientToWorld() is unreliable for 2D DWGs, so we always use visible bounds
    if (!isSnapped) {
      const impl = this.viewer.impl
      const visibleBounds = impl?.getVisibleBounds?.()

      if (!visibleBounds) {
        return false
      }

      const container = this.viewer.container
      const rect = container.getBoundingClientRect()
      const localX = event.clientX - rect.left
      const localY = event.clientY - rect.top

      const visWidth = visibleBounds.max.x - visibleBounds.min.x
      const visHeight = visibleBounds.max.y - visibleBounds.min.y

      // Page coords: X increases right, Y increases up (flip from screen)
      viewerX = visibleBounds.min.x + (localX / rect.width) * visWidth
      viewerY = visibleBounds.max.y - (localY / rect.height) * visHeight
    }

    // Log page coordinates (consumer converts to DWG for storage)
    console.log('[PlacementTool] Placed at page coords:', {
      page: { x: viewerX!.toFixed(2), y: viewerY!.toFixed(2), z: viewerZ.toFixed(2) },
      isSnapped,
      snapType,
    })

    // Return page coordinates - consumer must convert to DWG using getPageToModelTransform(1)
    this.onPlacement({
      worldX: viewerX!,  // Page X (named 'world' for API compatibility)
      worldY: viewerY!,  // Page Y
      worldZ: viewerZ,
      screenX,
      screenY,
      isSnapped,
      snapType,
    })

    return true // Consume the click event
  }
}
