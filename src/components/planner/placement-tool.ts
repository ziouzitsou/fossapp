/**
 * PlacementTool handles click-to-place interactions within the Autodesk Viewer.
 * It allows clicking to place markers while passing drag/scroll events
 * through to the default navigation tools (Pan/Zoom).
 *
 * Features:
 * - Snapping to geometry (vertices, midpoints, intersections, edges)
 * - Uses Autodesk.Snapping extension for proper snap detection
 * - World coordinate output for precise DWG-accurate placement
 * - Screen coordinates for MarkupsCore SVG layer
 *
 * Based on: https://aps.autodesk.com/blog/snappy-viewer-tools
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ViewerInstance = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Snapper = any

export interface PlacementCoords {
  // World coordinates (DWG model space)
  worldX: number
  worldY: number
  worldZ: number
  // Screen coordinates (for MarkupsCore)
  screenX: number
  screenY: number
  // Whether coordinates are snapped to geometry
  isSnapped: boolean
  // Snap type if snapped
  snapType?: string
}

export interface SnapState {
  isSnapped: boolean
  worldX: number
  worldY: number
  snapType?: string // 'vertex', 'edge', 'midpoint', 'intersection', etc.
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
  private names: string[] = ['placement-tool']
  private snapper: Snapper | null = null
  private snapperRegistered: boolean = false
  private lastSnapState: SnapState | null = null
  private snappingEnabled: boolean = true

  constructor(
    viewer: ViewerInstance,
    onPlacement: (coords: PlacementCoords) => void,
    onSnapChange?: (state: SnapState | null) => void
  ) {
    this.viewer = viewer
    this.onPlacement = onPlacement
    this.onSnapChange = onSnapChange
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
   * handleMouseMove - detect snap points as mouse moves
   * The snapper handles detection internally; we just need to check isSnapped
   * and render the indicator for visual feedback.
   * Returns false to allow pan/zoom tools to also receive the event.
   */
  handleMouseMove(event: MouseEvent): boolean {
    if (!this.snapper || !this.snappingEnabled) {
      if (this.lastSnapState) {
        this.lastSnapState = null
        this.onSnapChange?.(null)
      }
      return false
    }

    // Clear previous indicator
    this.snapper.indicator?.clearOverlays()

    // Check if snapper detected a snap point
    if (this.snapper.isSnapped()) {
      const result = this.snapper.getSnapResult()

      // Render visual indicator for the snap
      this.snapper.indicator?.render()

      if (result?.geomVertex) {
        const snapState: SnapState = {
          isSnapped: true,
          worldX: result.geomVertex.x,
          worldY: result.geomVertex.y,
          snapType: getSnapTypeName(result.geomType),
        }

        // Only notify if snap state changed
        if (!this.lastSnapState ||
            this.lastSnapState.worldX !== snapState.worldX ||
            this.lastSnapState.worldY !== snapState.worldY) {
          this.lastSnapState = snapState
          this.onSnapChange?.(snapState)
        }
      } else if (result?.intersectPoint) {
        const snapState: SnapState = {
          isSnapped: true,
          worldX: result.intersectPoint.x,
          worldY: result.intersectPoint.y,
          snapType: 'intersection',
        }

        if (!this.lastSnapState ||
            this.lastSnapState.worldX !== snapState.worldX ||
            this.lastSnapState.worldY !== snapState.worldY) {
          this.lastSnapState = snapState
          this.onSnapChange?.(snapState)
        }
      }
    } else {
      // No snap - clear state
      if (this.lastSnapState) {
        this.lastSnapState = null
        this.onSnapChange?.(null)
      }
    }

    return false // Allow pan/zoom to also handle the event
  }

  /**
   * handleSingleClick - place marker at clicked position
   * Uses snapped coordinates if available, otherwise falls back to manual calculation
   */
  handleSingleClick(event: MouseEvent, button: number): boolean {
    if (button !== 0) return false // Only handle left clicks

    const screenX = event.clientX
    const screenY = event.clientY

    let worldX: number
    let worldY: number
    let worldZ = 0
    let isSnapped = false
    let snapType: string | undefined

    // First, check if we have a snap
    if (this.snapper && this.snappingEnabled && this.snapper.isSnapped()) {
      const result = this.snapper.getSnapResult()

      if (result?.geomVertex) {
        worldX = result.geomVertex.x
        worldY = result.geomVertex.y
        worldZ = result.geomVertex.z || 0
        isSnapped = true
        snapType = getSnapTypeName(result.geomType)
        console.log('[PlacementTool] Placed with snap:', { worldX, worldY, snapType })
      } else if (result?.intersectPoint) {
        worldX = result.intersectPoint.x
        worldY = result.intersectPoint.y
        worldZ = result.intersectPoint.z || 0
        isSnapped = true
        snapType = 'intersection'
        console.log('[PlacementTool] Placed with intersection snap:', { worldX, worldY })
      }
    }

    // If no snap, calculate world coordinates manually
    if (!isSnapped) {
      // Try clientToWorld first (works for 3D)
      const clientToWorldResult = this.viewer.clientToWorld(event.clientX, event.clientY)
      const hasValidPoint = clientToWorldResult?.point?.x !== undefined

      if (hasValidPoint) {
        worldX = clientToWorldResult.point.x
        worldY = clientToWorldResult.point.y
        worldZ = clientToWorldResult.point.z || 0
      } else {
        // Fallback: use visible bounds conversion for 2D
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

        worldX = visibleBounds.min.x + (localX / rect.width) * visWidth
        worldY = visibleBounds.max.y - (localY / rect.height) * visHeight
      }
    }

    this.onPlacement({
      worldX: worldX!,
      worldY: worldY!,
      worldZ,
      screenX,
      screenY,
      isSnapped,
      snapType,
    })

    return true // Consume the click event
  }
}
