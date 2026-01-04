/**
 * Edit2D Markers - Label Utilities
 *
 * Handles ShapeLabel creation and styling for marker text labels.
 */

import type { Edit2DShape, Edit2DContext } from '@/types/autodesk-viewer'

/**
 * ShapeLabel reference type (Edit2D internal class)
 *
 * ShapeLabel has setVisible(), setText(), textDiv properties.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ShapeLabel = any

/**
 * Apply CSS styling to a ShapeLabel DOM element
 *
 * Sets font size, min dimensions, font weight, and text shadow for readability.
 *
 * @param label - ShapeLabel instance
 * @param minFontSize - Minimum font size in pixels
 */
export function applyLabelStyle(label: ShapeLabel, minFontSize: number): void {
  if (!label) return

  // ShapeLabel uses 'textDiv' for the text element
  const element = label.textDiv || label.container

  if (element instanceof HTMLElement) {
    // Apply minimum font size and styling for readability
    element.style.fontSize = `${minFontSize}px`
    element.style.minWidth = `${minFontSize * 1.5}px`
    element.style.minHeight = `${minFontSize}px`
    element.style.fontWeight = '600'
    element.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)'

    // Add hover class to parent container (.edit2d-label)
    const labelContainer = element.closest('.edit2d-label')
    if (labelContainer) {
      labelContainer.classList.add('marker-hoverable')
    }
  }
}

/**
 * Calculate minimum font size based on minScreenPx setting
 *
 * Labels should be about 60% of marker diameter for good readability.
 *
 * @param minScreenPx - Minimum marker diameter in pixels (user preference)
 * @returns Minimum font size in pixels (at least 8px)
 */
export function calculateMinFontSize(minScreenPx: number): number {
  return Math.max(8, Math.round(minScreenPx * 0.6))
}

/**
 * Create and attach a ShapeLabel to a shape
 *
 * @param shape - Edit2D shape to attach label to
 * @param text - Label text (e.g., "A1", "B2")
 * @param ctx - Edit2D context
 * @param minFontSize - Minimum font size in pixels
 * @returns ShapeLabel instance or null if creation failed
 */
export function createShapeLabel(
  shape: Edit2DShape,
  text: string,
  ctx: Edit2DContext,
  minFontSize: number
): ShapeLabel | null {
  if (!ctx?.layer || !window.Autodesk?.Edit2D?.ShapeLabel) {
    return null
  }

  try {
    const label = new window.Autodesk.Edit2D.ShapeLabel(shape, ctx.layer)
    label.setText(text)
    applyLabelStyle(label, minFontSize)
    return label
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.warn('[LabelUtils] Failed to create label:', errMsg)
    return null
  }
}
