/**
 * Edit2D Markers - Shape Factory
 *
 * Creates Edit2D shapes from SVG content or as fallback circles.
 *
 * Key design decisions (from aps-viewer research):
 * - Circles use polygon approximation (24 segments) instead of PolygonPath.setEllipseArc()
 *   because setEllipseArc() causes "t.clone is not a function" errors with layer.addShape()
 * - All shapes use Polygon/Polyline primitives for consistent behavior
 */

import type { Edit2DShape } from '@/types/autodesk-viewer'
import { MM_TO_METERS, DEFAULT_MARKER_RADIUS_MM, type UnitScales } from './types'

/** Number of segments for circle polygon approximation (more = smoother) */
const CIRCLE_SEGMENTS = 24

/**
 * Point in 2D space
 */
interface Point {
  x: number
  y: number
}

/**
 * Create a circle as a polygon approximation
 *
 * Uses 24 segments for smooth appearance. This approach is more reliable than
 * PolygonPath.setEllipseArc() which causes "t.clone is not a function" errors.
 *
 * @param cx - Center X in page coordinates
 * @param cy - Center Y in page coordinates
 * @param radius - Radius in page units
 * @param style - Optional style properties
 * @returns Edit2D Polygon shape representing the circle
 */
function createCircleAsPolygon(
  cx: number,
  cy: number,
  radius: number,
  style?: { stroke?: string; strokeWidth?: number; fill?: string; fillAlpha?: number }
): Edit2DShape | null {
  const Edit2D = window.Autodesk?.Edit2D
  if (!Edit2D?.Polygon) return null

  // Generate circle points
  const points: Point[] = []
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const angle = (i / CIRCLE_SEGMENTS) * 2 * Math.PI
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    })
  }

  // Create polygon
  const polygon = new Edit2D.Polygon(points)

  // Apply style
  if (polygon.style) {
    if (style?.stroke) {
      polygon.style.lineColor = style.stroke
    }
    if (style?.strokeWidth !== undefined) {
      polygon.style.lineWidth = style.strokeWidth
    }
    if (style?.fill && style.fill !== 'none') {
      polygon.style.fillColor = style.fill
      polygon.style.fillAlpha = style.fillAlpha ?? 1
    } else {
      polygon.style.fillAlpha = 0
    }
  }

  return polygon as Edit2DShape
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
  if (!Edit2D?.Polygon || !Edit2D?.Polyline) {
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

    // Process <circle> elements -> Polygon approximation (24 segments)
    // Note: PolygonPath.setEllipseArc() causes "t.clone is not a function" errors
    svgElement.querySelectorAll('circle').forEach((circle) => {
      const cx = parseFloat(circle.getAttribute('cx') || '0')
      const cy = parseFloat(circle.getAttribute('cy') || '0')
      const r = parseFloat(circle.getAttribute('r') || '0')
      const stroke = circle.getAttribute('stroke') || '#000000'

      if (r <= 0) return

      // Transform the center point
      const center = transformPoint(cx, cy)
      const scaledRadius = r * scale

      // Create circle as polygon
      const circleShape = createCircleAsPolygon(center.x, center.y, scaledRadius, {
        stroke,
        strokeWidth: scale * 1.5,
      })

      if (circleShape) {
        shapes.push(circleShape)
      }
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
 * Uses polygon approximation (24 segments) for reliable rendering.
 * This approach avoids "t.clone is not a function" errors from setEllipseArc().
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
  try {
    // Calculate radius in page units
    const radiusMm = DEFAULT_MARKER_RADIUS_MM
    const mmToPageUnits = MM_TO_METERS / (unitScales.modelUnitScale * unitScales.pageToModelScale)
    const radius = radiusMm * mmToPageUnits

    // Create circle as polygon
    const circleShape = createCircleAsPolygon(pageX, pageY, radius, {
      stroke: '#ffffff',
      strokeWidth: radius * 0.15,
      fill: '#3b82f6',
      fillAlpha: 1,
    })

    if (!circleShape) {
      console.warn('[ShapeFactory] Failed to create fallback circle polygon')
      return null
    }

    return [circleShape]
  } catch (err) {
    console.error('[ShapeFactory] Failed to create circle shape:', err)
    return null
  }
}
