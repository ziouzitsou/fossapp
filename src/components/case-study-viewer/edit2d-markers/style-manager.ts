/**
 * Shape Style Manager
 *
 * Manages visual styling for shape hover, selection, ghost, and preview states.
 * Stores original styles and provides functions to apply/restore styles.
 *
 * Adapted from aps-viewer testing sandbox for FOSSAPP Case Study viewer.
 */

import type { Edit2DShape } from '@/types/autodesk-viewer'

/**
 * Style constants for hover, selection, and effects
 */
export const STYLE_CONSTANTS = {
  /** Hover style - blue highlight */
  HOVER: {
    lineColor: 'rgb(59, 130, 246)', // Blue-500
    lineWidth: 5,
  },
  /** Selected style - green highlight */
  SELECTED: {
    lineColor: 'rgb(34, 197, 94)', // Green-500
    lineWidth: 2.5,
  },
  /** Preview style - semi-transparent for move preview */
  PREVIEW: {
    fillAlpha: 0.5,
    lineColor: 'rgb(56, 189, 248)', // Sky-400
    lineWidth: 2,
  },
  /** Ghost style - dimmed original during move */
  GHOST: {
    fillAlpha: 0.2,
  },
} as const

/**
 * Stored original style for a shape
 */
interface OriginalStyle {
  lineColor: string
  lineWidth: number
  fillAlpha: number
  fillColor: string
}

/**
 * Shape Style Manager
 *
 * Maintains a map of original styles so they can be restored
 * when shapes are deselected, unhovered, or move is cancelled.
 *
 * @example
 * ```ts
 * const styleManager = new ShapeStyleManager();
 *
 * // Apply hover style
 * styleManager.applyHoverStyle(shape);
 *
 * // Later, restore original
 * styleManager.restoreOriginalStyle(shape);
 * ```
 */
export class ShapeStyleManager {
  private originalStyles = new Map<number, OriginalStyle>()

  /**
   * Save the original style of a shape (if not already saved).
   * Call this before modifying any styles.
   */
  saveOriginalStyle(shape: Edit2DShape): void {
    if (!this.originalStyles.has(shape.id)) {
      this.originalStyles.set(shape.id, {
        lineColor: shape.style.lineColor,
        lineWidth: shape.style.lineWidth,
        fillAlpha: shape.style.fillAlpha ?? 1,
        fillColor: shape.style.fillColor ?? 'none',
      })
    }
  }

  /**
   * Apply hover style (blue, thick line) to a shape.
   * Automatically saves original style first.
   */
  applyHoverStyle(shape: Edit2DShape): void {
    this.saveOriginalStyle(shape)
    shape.style.lineColor = STYLE_CONSTANTS.HOVER.lineColor
    shape.style.lineWidth = STYLE_CONSTANTS.HOVER.lineWidth
  }

  /**
   * Apply selected style (green, medium-thick line) to a shape.
   * Automatically saves original style first.
   */
  applySelectedStyle(shape: Edit2DShape): void {
    this.saveOriginalStyle(shape)
    shape.style.lineColor = STYLE_CONSTANTS.SELECTED.lineColor
    shape.style.lineWidth = STYLE_CONSTANTS.SELECTED.lineWidth
  }

  /**
   * Apply preview style to a shape (semi-transparent).
   * Used for ghost preview during move mode.
   */
  applyPreviewStyle(shape: Edit2DShape): void {
    this.saveOriginalStyle(shape)
    shape.style.fillAlpha = STYLE_CONSTANTS.PREVIEW.fillAlpha
    shape.style.lineColor = STYLE_CONSTANTS.PREVIEW.lineColor
    shape.style.lineWidth = STYLE_CONSTANTS.PREVIEW.lineWidth
  }

  /**
   * Apply ghost style to a shape (reduced opacity).
   * Used to dim original shapes during move mode.
   */
  applyGhostStyle(shape: Edit2DShape): void {
    this.saveOriginalStyle(shape)
    shape.style.fillAlpha = STYLE_CONSTANTS.GHOST.fillAlpha
  }

  /**
   * Restore the original style of a shape.
   * No-op if original style wasn't saved.
   */
  restoreOriginalStyle(shape: Edit2DShape): void {
    const original = this.originalStyles.get(shape.id)
    if (original) {
      shape.style.lineColor = original.lineColor
      shape.style.lineWidth = original.lineWidth
      shape.style.fillAlpha = original.fillAlpha
      if (original.fillColor !== 'none') {
        shape.style.fillColor = original.fillColor
      }
    }
  }

  /**
   * Restore full opacity to a shape.
   * Used after cancelling move mode.
   */
  restoreFullOpacity(shape: Edit2DShape): void {
    const original = this.originalStyles.get(shape.id)
    if (original) {
      shape.style.fillAlpha = original.fillAlpha
    } else {
      shape.style.fillAlpha = 1
    }
  }

  /**
   * Check if we have saved original style for a shape.
   */
  hasOriginalStyle(shapeId: number): boolean {
    return this.originalStyles.has(shapeId)
  }

  /**
   * Get the original style for a shape (if saved).
   */
  getOriginalStyle(shapeId: number): OriginalStyle | undefined {
    return this.originalStyles.get(shapeId)
  }

  /**
   * Clear all saved styles.
   * Call this when resetting the manager.
   */
  clear(): void {
    this.originalStyles.clear()
  }

  /**
   * Remove saved style for a specific shape.
   * Call this when a shape is deleted.
   */
  remove(shapeId: number): void {
    this.originalStyles.delete(shapeId)
  }
}
