/**
 * PlacementTool handles click-to-place interactions within the Autodesk Viewer.
 * It allows clicking to place markers while passing drag/scroll events
 * through to the default navigation tools (Pan/Zoom).
 *
 * Key insight: By ONLY implementing handleSingleClick (not handleButtonDown,
 * handleMouseMove, or handleWheelInput), those events automatically pass through
 * to the pan/zoom tools in the viewer stack.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ViewerInstance = any

export interface PlacementCoords {
  x: number
  y: number
  z: number
}

export class PlacementTool {
  private viewer: ViewerInstance
  private onPlacement: (coords: PlacementCoords) => void
  private names: string[] = ['placement-tool']

  constructor(viewer: ViewerInstance, onPlacement: (coords: PlacementCoords) => void) {
    this.viewer = viewer
    this.onPlacement = onPlacement
  }

  getNames() { return this.names }
  getName() { return this.names[0] }

  activate() {
    if (this.viewer.canvas) {
      this.viewer.canvas.style.cursor = 'crosshair'
    }
  }

  deactivate() {
    if (this.viewer.canvas) {
      this.viewer.canvas.style.cursor = ''
    }
  }

  /**
   * handleSingleClick is only called by the ToolController if the
   * interaction was a clean click (no significant mouse movement).
   * This is the key to allowing pan/zoom to work while still capturing clicks.
   */
  handleSingleClick(event: MouseEvent, button: number): boolean {
    if (button !== 0) return false // Only handle left clicks

    // Try clientToWorld first (works for 3D)
    const clientToWorldResult = this.viewer.clientToWorld(event.clientX, event.clientY)

    // For 2D views, clientToWorld returns null or has no point - use visible bounds
    // clientToWorld returns { point: Vector3 } when it hits geometry
    const hasValidPoint = clientToWorldResult?.point?.x !== undefined

    let worldX: number
    let worldY: number
    let worldZ = 0

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
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top

      const visWidth = visibleBounds.max.x - visibleBounds.min.x
      const visHeight = visibleBounds.max.y - visibleBounds.min.y

      // Convert screen coords to world coords
      worldX = visibleBounds.min.x + (screenX / rect.width) * visWidth
      worldY = visibleBounds.max.y - (screenY / rect.height) * visHeight
    }

    this.onPlacement({ x: worldX, y: worldY, z: worldZ })
    return true // Consume the click event
  }

  // NOTE: By NOT implementing handleButtonDown, handleMouseMove, or
  // handleWheelInput, these events are automatically passed to the
  // default 'pan' and 'zoom' tools in the viewer stack.
}
