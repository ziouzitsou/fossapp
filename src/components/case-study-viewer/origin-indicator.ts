/**
 * Origin Indicator for Case Study Viewer
 *
 * Displays a visual indicator at the DWG origin (0,0) using Edit2D shapes.
 * The indicator shows coordinate axes (X→, Y↑) to help users understand
 * the drawing's coordinate system.
 *
 * Design notes:
 * - Uses Edit2D Polyline/Polygon for axes and arrowheads
 * - Positioned at page coordinates corresponding to DWG (0,0)
 * - Green color (#22c55e) for visibility against typical DWG backgrounds
 * - Non-interactive (visual indicator only)
 * - Size is in DWG units (configurable, default 100mm)
 */

import type { Edit2DContext, Edit2DShape } from '@/types/autodesk-viewer'

/** Green color for origin indicator (Tailwind green-500) */
const ORIGIN_COLOR = '#22c55e'

/** Default size of the origin indicator in DWG model units (mm) */
const DEFAULT_SIZE_MM = 100

/** Arrow head size as proportion of axis length */
const ARROW_HEAD_RATIO = 0.15

/** Line width as proportion of axis length */
const LINE_WIDTH_RATIO = 0.02

/**
 * Configuration for the origin indicator
 */
export interface OriginIndicatorConfig {
  /** Size of each axis in DWG units (default: 100) */
  sizeMm?: number
  /** Color for the indicator (default: green-500) */
  color?: string
}

/**
 * OriginIndicator - Displays coordinate axes at DWG origin
 *
 * Creates a visual indicator showing the X and Y axes with arrowheads
 * at the DWG origin (0,0). This helps users understand the coordinate
 * system of the drawing.
 */
export class OriginIndicator {
  private ctx: Edit2DContext | null = null
  private shapes: Edit2DShape[] = []
  private isVisible: boolean = false

  // Coordinate conversion function (set during initialization)
  private dwgToPageCoords: ((x: number, y: number) => { x: number; y: number }) | null = null

  // Model unit scale (e.g., 0.001 for mm, 1 for meters)
  private modelUnitScale: number = 1

  /**
   * Initialize the origin indicator
   *
   * @param ctx - Edit2D context from the viewer
   * @param dwgToPageCoords - Function to convert DWG coords to page coords
   * @param modelUnitScale - Model unit scale (e.g., 0.001 for mm, 1 for meters)
   */
  initialize(
    ctx: Edit2DContext,
    dwgToPageCoords: (x: number, y: number) => { x: number; y: number },
    modelUnitScale: number = 1
  ): void {
    this.ctx = ctx
    this.dwgToPageCoords = dwgToPageCoords
    this.modelUnitScale = modelUnitScale
  }

  /**
   * Show the origin indicator
   *
   * @param config - Optional configuration overrides
   */
  show(config?: OriginIndicatorConfig): void {
    if (!this.ctx || !this.dwgToPageCoords || this.isVisible) return

    const sizeMm = config?.sizeMm ?? DEFAULT_SIZE_MM
    const color = config?.color ?? ORIGIN_COLOR

    // Convert mm to DWG units
    // modelUnitScale: 0.001 for mm (1mm = 0.001m), 1 for meters
    // If DWG is in mm: sizeMm stays as is (sizeMm / 1000 / 0.001 = sizeMm)
    // If DWG is in meters: sizeMm becomes sizeMm/1000 (e.g., 100mm → 0.1m)
    const sizeInDwgUnits = (sizeMm / 1000) / this.modelUnitScale

    // Convert DWG origin (0,0) to page coordinates
    const origin = this.dwgToPageCoords(0, 0)

    // Calculate axis length in page units by converting a reference point
    // This automatically handles any coordinate transformation
    const xAxisEndDwg = this.dwgToPageCoords(sizeInDwgUnits, 0)
    const axisLength = Math.abs(xAxisEndDwg.x - origin.x)
    const arrowSize = axisLength * ARROW_HEAD_RATIO
    const lineWidth = Math.max(axisLength * LINE_WIDTH_RATIO, 0.5) // Minimum line width

    const Edit2D = window.Autodesk?.Edit2D
    if (!Edit2D?.Polyline || !Edit2D?.Polygon) {
      console.warn('[OriginIndicator] Edit2D not available')
      return
    }

    // Get Y-axis end point to determine Y direction in page coords
    // (DWG Y points up, but page coords may have Y pointing down)
    const yAxisEndDwg = this.dwgToPageCoords(0, sizeInDwgUnits)
    const yFlipped = origin.y > yAxisEndDwg.y // Y is flipped if origin.y > end.y

    // Circle radius is 1/3 of axis length, cross extends beyond circle
    const circleRadius = axisLength * 0.33
    const crossExtend = axisLength // Full axis length for the cross arms

    // ═══════════════════════════════════════════════════════════════════════
    // HORIZONTAL LINE (X-axis through origin)
    // ═══════════════════════════════════════════════════════════════════════
    const hLine = new Edit2D.Polyline([
      { x: origin.x - crossExtend, y: origin.y },
      { x: origin.x + crossExtend, y: origin.y }
    ])
    if (hLine.style) {
      hLine.style.lineColor = color
      hLine.style.lineWidth = lineWidth
    }
    this.shapes.push(hLine as Edit2DShape)

    // ═══════════════════════════════════════════════════════════════════════
    // VERTICAL LINE (Y-axis through origin)
    // ═══════════════════════════════════════════════════════════════════════
    const vLineTop = yFlipped ? origin.y - crossExtend : origin.y + crossExtend
    const vLineBottom = yFlipped ? origin.y + crossExtend : origin.y - crossExtend
    const vLine = new Edit2D.Polyline([
      { x: origin.x, y: vLineBottom },
      { x: origin.x, y: vLineTop }
    ])
    if (vLine.style) {
      vLine.style.lineColor = color
      vLine.style.lineWidth = lineWidth
    }
    this.shapes.push(vLine as Edit2DShape)

    // ═══════════════════════════════════════════════════════════════════════
    // CIRCLE OUTLINE
    // ═══════════════════════════════════════════════════════════════════════
    const circleSegments = 32
    const circlePoints: { x: number; y: number }[] = []
    for (let i = 0; i < circleSegments; i++) {
      const angle = (i / circleSegments) * 2 * Math.PI
      circlePoints.push({
        x: origin.x + circleRadius * Math.cos(angle),
        y: origin.y + circleRadius * Math.sin(angle),
      })
    }
    const circle = new Edit2D.Polygon(circlePoints)
    if (circle.style) {
      circle.style.lineColor = color
      circle.style.lineWidth = lineWidth
      circle.style.fillAlpha = 0 // No fill, just outline
    }
    this.shapes.push(circle as Edit2DShape)

    // ═══════════════════════════════════════════════════════════════════════
    // FILLED QUADRANTS (upper-right and lower-left in DWG space)
    // ═══════════════════════════════════════════════════════════════════════
    const quadrantSegments = 8

    // Helper to create a quadrant pie slice
    const createQuadrant = (startAngle: number): Edit2DShape => {
      const points: { x: number; y: number }[] = [{ x: origin.x, y: origin.y }]
      for (let i = 0; i <= quadrantSegments; i++) {
        const angle = startAngle + (i / quadrantSegments) * (Math.PI / 2)
        points.push({
          x: origin.x + circleRadius * Math.cos(angle),
          y: origin.y + circleRadius * Math.sin(angle),
        })
      }
      const quadrant = new Edit2D.Polygon(points)
      if (quadrant.style) {
        quadrant.style.lineColor = color
        quadrant.style.lineWidth = 0
        quadrant.style.fillColor = color
        quadrant.style.fillAlpha = 1
      }
      return quadrant as Edit2DShape
    }

    // In page coords with Y possibly flipped:
    // - Upper-right in DWG (positive X, positive Y)
    // - Lower-left in DWG (negative X, negative Y)
    if (yFlipped) {
      // Y is flipped: DWG upper-right = page lower-right (angle -π/2 to 0)
      this.shapes.push(createQuadrant(-Math.PI / 2))
      // DWG lower-left = page upper-left (angle π/2 to π)
      this.shapes.push(createQuadrant(Math.PI / 2))
    } else {
      // Y is not flipped: DWG upper-right = page upper-right (angle 0 to π/2)
      this.shapes.push(createQuadrant(0))
      // DWG lower-left = page lower-left (angle π to 3π/2)
      this.shapes.push(createQuadrant(Math.PI))
    }

    // Add all shapes to the layer
    for (const shape of this.shapes) {
      this.ctx.addShape(shape)
    }

    this.isVisible = true
    this.ctx.layer?.update()
  }

  /**
   * Hide the origin indicator
   */
  hide(): void {
    if (!this.ctx || !this.isVisible) return

    for (const shape of this.shapes) {
      this.ctx.removeShape(shape)
    }

    this.shapes = []
    this.isVisible = false
    this.ctx.layer?.update()
  }

  /**
   * Toggle visibility of the origin indicator
   */
  toggle(config?: OriginIndicatorConfig): void {
    if (this.isVisible) {
      this.hide()
    } else {
      this.show(config)
    }
  }

  /**
   * Check if the indicator is currently visible
   */
  getIsVisible(): boolean {
    return this.isVisible
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.hide()
    this.ctx = null
    this.dwgToPageCoords = null
  }
}
