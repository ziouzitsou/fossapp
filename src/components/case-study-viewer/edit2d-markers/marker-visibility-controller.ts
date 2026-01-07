/**
 * MarkerVisibilityController - Handles marker visibility by symbol group
 *
 * Extracted from Edit2DMarkers to reduce file size and improve modularity.
 * This controller manages:
 * - Hiding/showing markers by symbol group (e.g., "A1", "B2")
 * - Tracking which groups are currently hidden
 * - Batch visibility updates
 */

import type { Edit2DContext, Edit2DShape } from '@/types/autodesk-viewer'

import type { Edit2DMarkerData } from './types'

/**
 * Interface for the parent marker manager that this controller needs access to
 */
export interface MarkerVisibilityParent {
  getContext(): Edit2DContext | null
  getAllMarkerData(): Map<string, Edit2DMarkerData>
  getMarkerShapes(id: string): Edit2DShape[] | undefined
  getLabel(id: string): { setVisible: (visible: boolean) => void } | undefined
}

/**
 * Controller for marker visibility management by symbol group
 */
export class MarkerVisibilityController {
  private parent: MarkerVisibilityParent

  // Hidden symbol groups (by full symbol, e.g., "A1", "B2")
  private hiddenGroups: Set<string> = new Set()

  constructor(parent: MarkerVisibilityParent) {
    this.parent = parent
  }

  /**
   * Check if a symbol group is hidden
   */
  isSymbolHidden(symbol: string): boolean {
    return this.hiddenGroups.has(symbol)
  }

  /**
   * Get all hidden symbol groups
   */
  getHiddenGroups(): Set<string> {
    return new Set(this.hiddenGroups)
  }

  /**
   * Hide all markers with the given symbol
   */
  hideSymbolGroup(symbol: string): void {
    if (this.hiddenGroups.has(symbol)) return

    const ctx = this.parent.getContext()
    if (!ctx) return

    this.hiddenGroups.add(symbol)

    for (const [id, data] of this.parent.getAllMarkerData()) {
      if (data.symbol === symbol) {
        const shapes = this.parent.getMarkerShapes(id)
        if (shapes) {
          for (const shape of shapes) {
            ctx.removeShape(shape)
          }
        }

        // Also hide the label
        const label = this.parent.getLabel(id)
        if (label) {
          label.setVisible(false)
        }
      }
    }

    ctx.layer.update()
  }

  /**
   * Show all markers with the given symbol
   */
  showSymbolGroup(symbol: string): void {
    if (!this.hiddenGroups.has(symbol)) return

    const ctx = this.parent.getContext()
    if (!ctx) return

    this.hiddenGroups.delete(symbol)

    for (const [id, data] of this.parent.getAllMarkerData()) {
      if (data.symbol === symbol) {
        const shapes = this.parent.getMarkerShapes(id)
        if (shapes) {
          for (const shape of shapes) {
            ctx.addShape(shape)
          }
        }

        // Also show the label
        const label = this.parent.getLabel(id)
        if (label) {
          label.setVisible(true)
        }
      }
    }

    ctx.layer.update()
  }

  /**
   * Apply visibility from a Set of hidden symbols
   * Efficiently computes the diff and only updates changed groups
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
   * Clear all hidden groups (show everything)
   */
  clearHiddenGroups(): void {
    const ctx = this.parent.getContext()
    if (!ctx) return

    for (const symbol of this.hiddenGroups) {
      for (const [id, data] of this.parent.getAllMarkerData()) {
        if (data.symbol === symbol) {
          const shapes = this.parent.getMarkerShapes(id)
          if (shapes) {
            for (const shape of shapes) {
              ctx.addShape(shape)
            }
          }

          const label = this.parent.getLabel(id)
          if (label) {
            label.setVisible(true)
          }
        }
      }
    }

    this.hiddenGroups.clear()
    ctx.layer.update()
  }

  /**
   * Cleanup on dispose
   */
  dispose(): void {
    this.hiddenGroups.clear()
  }
}
