/**
 * MarkerKeyboardHandler - Handles keyboard events for markers
 *
 * Extracted from Edit2DMarkers to reduce file size and improve modularity.
 * This handler manages:
 * - Delete/Backspace to delete selected marker
 * - R key to rotate selected marker
 * - M key to start move mode
 * - ESC to cancel move mode
 */

import { MarkerMoveController } from './marker-move-controller'

/**
 * Interface for the parent marker manager
 */
export interface MarkerKeyboardParent {
  getSelectedId(): string | null
  deleteMarker(id: string): void
  rotateMarker(id: string, deltaDegrees: number): Promise<void>
  getMoveController(): MarkerMoveController
}

/**
 * Handler for keyboard events related to markers
 */
export class MarkerKeyboardHandler {
  private parent: MarkerKeyboardParent
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null

  constructor(parent: MarkerKeyboardParent) {
    this.parent = parent
  }

  /**
   * Set up keyboard listeners
   */
  setup(): void {
    this.boundKeyHandler = this.handleKeyDown.bind(this)
    window.addEventListener('keydown', this.boundKeyHandler, true)
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    const moveController = this.parent.getMoveController()
    const selectedId = this.parent.getSelectedId()

    // ESC: Cancel move mode
    if (e.key === 'Escape' && moveController.isMoving()) {
      e.preventDefault()
      e.stopPropagation()
      moveController.cancelMove()
      return
    }

    // Delete selected marker
    if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()
      e.stopPropagation()
      this.parent.deleteMarker(selectedId)
    }

    // Rotate selected marker by 15 degrees
    if (selectedId && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.shiftKey ? 15 : -15
      this.parent.rotateMarker(selectedId, delta)
    }

    // M key: Start move mode for selected marker
    if (selectedId && !moveController.isMoving() && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault()
      e.stopPropagation()
      moveController.startMove(selectedId)
    }
  }

  /**
   * Clean up event listeners
   */
  dispose(): void {
    if (this.boundKeyHandler) {
      window.removeEventListener('keydown', this.boundKeyHandler, true)
      this.boundKeyHandler = null
    }
  }
}
