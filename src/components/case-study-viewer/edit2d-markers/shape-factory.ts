/**
 * Edit2D Markers - Shape Factory
 *
 * Creates Edit2D shapes from SVG content or as fallback circles.
 * Uses Edit2D's native shape classes for smooth, geometrically accurate rendering.
 */

import type { Edit2DShape } from '@/types/autodesk-viewer'
import { MM_TO_METERS, DEFAULT_MARKER_RADIUS_MM, type UnitScales } from './types'

/**
 * Point in 2D space
 */
interface Point {
  x: number
  y: number
}

/**
 * Create a point transformation function for SVG to page coordinates
 *
 * Handles scaling, rotation around center, and translation to page position.
 *
 * @param svgCenterX - Center X of SVG viewBox
 * @param svgCenterY - Center Y of SVG viewBox
 * @param scale - Scale factor from SVG units to page units
 * @param pageX - Target page X coordinate
 * @param pageY - Target page Y coordinate
 * @param rotation - Rotation in degrees
 */
function createPointTransformer(
  svgCenterX: number,
  svgCenterY: number,
  scale: number,
  pageX: number,
  pageY: number,
  rotation: number
): (svgX: number, svgY: number) => Point {
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  return (svgX: number, svgY: number): Point => {
    // Translate to origin (relative to SVG center)
    const dx = (svgX - svgCenterX) * scale
    const dy = (svgY - svgCenterY) * scale
    // Rotate
    const rx = dx * cos - dy * sin
    const ry = dx * sin + dy * cos
    // Translate to page position
    return { x: pageX + rx, y: pageY + ry }
  }
}

/**
 * Calculate the scale factor for converting SVG units to page units
 *
 * @param isRealMm - Whether SVG uses real millimeter units (data-unit="mm")
 * @param vbWidth - ViewBox width
 * @param vbHeight - ViewBox height
 * @param unitScales - Model and page-to-model scale factors
 */
function calculateScale(
  isRealMm: boolean,
  vbWidth: number,
  vbHeight: number,
  unitScales: UnitScales
): number {
  const mmToPageUnits = MM_TO_METERS / (unitScales.modelUnitScale * unitScales.pageToModelScale)
  return isRealMm
    ? mmToPageUnits
    : (100 * mmToPageUnits) / Math.max(vbWidth, vbHeight)
}

/**
 * Create Edit2D shapes from SVG content
 *
 * Handles SVG primitives using Edit2D's native shape classes:
 * - <rect> -> Polygon (4-point closed shape)
 * - <circle> -> PolygonPath with setEllipseArc() (true circles, not polygon approximations)
 * - <line> -> Polyline (native line primitive)
 *
 * @param svgContent - Raw SVG string content
 * @param pageX - Target page X coordinate (center)
 * @param pageY - Target page Y coordinate (center)
 * @param rotation - Rotation in degrees
 * @param unitScales - Unit scaling factors
 * @returns Array of Edit2D shapes, or null on failure
 */
export function createShapesFromSvg(
  svgContent: string,
  pageX: number,
  pageY: number,
  rotation: number,
  unitScales: UnitScales
): Edit2DShape[] | null {
  const Edit2D = window.Autodesk?.Edit2D
  if (!Edit2D?.Polygon || !Edit2D?.PolygonPath || !Edit2D?.Polyline || !Edit2D?.EllipseArcParams) {
    console.warn('[ShapeFactory] Autodesk.Edit2D shape classes not available')
    return null
  }

  try {
    // Parse SVG
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svgElement = svgDoc.querySelector('svg')

    if (!svgElement) {
      console.warn('[ShapeFactory] No SVG element found')
      return null
    }

    // Get viewBox for dimensions and centering
    const viewBox = svgElement.getAttribute('viewBox') || '0 0 100 100'
    const [vbX, vbY, vbWidth, vbHeight] = viewBox.split(' ').map(Number)

    // Check if it's a real-mm SVG (data-unit="mm")
    const dataUnit = svgElement.getAttribute('data-unit')
    const isRealMm = dataUnit === 'mm'

    // Calculate scale factor
    const scale = calculateScale(isRealMm, vbWidth, vbHeight, unitScales)

    // SVG center (for centering at pageX, pageY)
    const svgCenterX = vbX + vbWidth / 2
    const svgCenterY = vbY + vbHeight / 2

    // Create point transformer
    const transformPoint = createPointTransformer(
      svgCenterX, svgCenterY, scale, pageX, pageY, rotation
    )

    // Collect all shapes
    const shapes: Edit2DShape[] = []

    // Process <rect> elements -> 4-point Polygon
    svgElement.querySelectorAll('rect').forEach((rect) => {
      const x = parseFloat(rect.getAttribute('x') || '0')
      const y = parseFloat(rect.getAttribute('y') || '0')
      const w = parseFloat(rect.getAttribute('width') || '0')
      const h = parseFloat(rect.getAttribute('height') || '0')
      const stroke = rect.getAttribute('stroke') || '#000000'

      const points = [
        transformPoint(x, y),
        transformPoint(x + w, y),
        transformPoint(x + w, y + h),
        transformPoint(x, y + h),
      ]

      const polygon = new Edit2D.Polygon(points)
      if (polygon.style) {
        polygon.style.lineColor = stroke
        polygon.style.lineWidth = scale * 1.5
        polygon.style.fillAlpha = 0 // No fill for outline shapes
      }
      shapes.push(polygon as Edit2DShape)
    })

    // Process <circle> elements -> PolygonPath with ellipse arcs (true circles)
    svgElement.querySelectorAll('circle').forEach((circle) => {
      const cx = parseFloat(circle.getAttribute('cx') || '0')
      const cy = parseFloat(circle.getAttribute('cy') || '0')
      const r = parseFloat(circle.getAttribute('r') || '0')
      const stroke = circle.getAttribute('stroke') || '#000000'

      if (r <= 0) return

      // Transform the two diametrically opposite points (left and right of center)
      const leftPoint = transformPoint(cx - r, cy)
      const rightPoint = transformPoint(cx + r, cy)

      // Create PolygonPath with 2 points
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const polygonPath = new Edit2D.PolygonPath([leftPoint, rightPoint]) as any

      // Calculate scaled radius (after transformation)
      const scaledRadius = r * scale

      // Create arc parameters for the semicircles
      const params = new Edit2D.EllipseArcParams()
      params.rx = scaledRadius
      params.ry = scaledRadius
      params.rotation = rotation // Apply marker rotation to arcs
      params.largeArcFlag = false // Semicircle is not "large"
      params.sweepFlag = true     // Clockwise

      // Apply to both segments (top half and bottom half)
      polygonPath.setEllipseArc(0, params) // Top arc
      polygonPath.setEllipseArc(1, params) // Bottom arc

      if (polygonPath.style) {
        polygonPath.style.lineColor = stroke
        polygonPath.style.lineWidth = scale * 1.5
        polygonPath.style.fillAlpha = 0
      }
      shapes.push(polygonPath as Edit2DShape)
    })

    // Process <line> elements -> Polyline (native Edit2D primitive)
    svgElement.querySelectorAll('line').forEach((line) => {
      const x1 = parseFloat(line.getAttribute('x1') || '0')
      const y1 = parseFloat(line.getAttribute('y1') || '0')
      const x2 = parseFloat(line.getAttribute('x2') || '0')
      const y2 = parseFloat(line.getAttribute('y2') || '0')
      const stroke = line.getAttribute('stroke') || '#000000'
      const strokeWidth = parseFloat(line.getAttribute('stroke-width') || '1')

      const points = [
        transformPoint(x1, y1),
        transformPoint(x2, y2),
      ]

      const polyline = new Edit2D.Polyline(points)
      if (polyline.style) {
        polyline.style.lineColor = stroke
        polyline.style.lineWidth = strokeWidth * scale
      }
      shapes.push(polyline as Edit2DShape)
    })

    if (shapes.length === 0) {
      console.warn('[ShapeFactory] No shapes extracted from SVG')
      return null
    }

    return shapes
  } catch (err) {
    console.error('[ShapeFactory] Failed to create shapes from SVG:', err)
    return null
  }
}

/**
 * Create a circle shape as fallback marker
 *
 * Uses Edit2D's native PolygonPath with setEllipseArc() for true circles.
 * This gives smooth, geometrically accurate circles instead of polygon approximations.
 *
 * @param pageX - Center X coordinate
 * @param pageY - Center Y coordinate
 * @param unitScales - Unit scaling factors
 * @returns Array with single circle shape, or null on failure
 */
export function createFallbackCircleShape(
  pageX: number,
  pageY: number,
  unitScales: UnitScales
): Edit2DShape[] | null {
  const Edit2D = window.Autodesk?.Edit2D
  if (!Edit2D?.PolygonPath || !Edit2D?.EllipseArcParams) {
    console.warn('[ShapeFactory] Autodesk.Edit2D PolygonPath/EllipseArcParams not available')
    return null
  }

  try {
    // Calculate radius in page units
    const radiusMm = DEFAULT_MARKER_RADIUS_MM
    const mmToPageUnits = MM_TO_METERS / (unitScales.modelUnitScale * unitScales.pageToModelScale)
    const radius = radiusMm * mmToPageUnits

    // Create PolygonPath with 2 diametrically opposite points
    const leftPoint = { x: pageX - radius, y: pageY }
    const rightPoint = { x: pageX + radius, y: pageY }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const polygonPath = new Edit2D.PolygonPath([leftPoint, rightPoint]) as any

    // Create arc parameters for the semicircles
    const params = new Edit2D.EllipseArcParams()
    params.rx = radius
    params.ry = radius
    params.rotation = 0
    params.largeArcFlag = false // Semicircle is not "large"
    params.sweepFlag = true     // Clockwise

    // Apply to both segments (top half and bottom half)
    polygonPath.setEllipseArc(0, params) // Top arc
    polygonPath.setEllipseArc(1, params) // Bottom arc

    // Set style (blue fill with white stroke)
    if (polygonPath.style) {
      polygonPath.style.fillColor = '#3b82f6'
      polygonPath.style.fillAlpha = 1
      polygonPath.style.lineColor = '#ffffff'
      polygonPath.style.lineWidth = radius * 0.15
    }

    return [polygonPath as Edit2DShape]
  } catch (err) {
    console.error('[ShapeFactory] Failed to create circle shape:', err)
    return null
  }
}
