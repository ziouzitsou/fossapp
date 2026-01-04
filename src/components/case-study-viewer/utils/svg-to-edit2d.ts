/**
 * SVG Primitive to Edit2D Path Conversion
 *
 * Converts SVG primitives (rect, circle, ellipse, line, polyline, polygon, path)
 * into SVG path `d` attribute strings that Edit2D's Shape.fromSVG() can render.
 *
 * Key benefit: Circles and ellipses use proper arc commands (`A`) instead of
 * polyline approximations, resulting in geometrically accurate curves.
 *
 * @example
 * ```typescript
 * import { convertSvgToPaths } from './svg-to-edit2d'
 *
 * const svgString = '<svg>...</svg>'
 * const paths = convertSvgToPaths(svgString)
 *
 * paths.forEach(({ d, style }) => {
 *   const shape = Autodesk.Edit2D.Shape.fromSVG(`<path d="${d}" />`)
 *   shape.style.strokeColor = style.strokeColor
 *   layer.addShape(shape)
 * })
 * ```
 */

export interface SVGAttributes {
  [key: string]: string | number
}

export interface PathStyle {
  strokeColor: string | null
  strokeWidth: number
  fillColor: string | null
  fillAlpha: number
}

export interface ConvertedPath {
  d: string
  style: PathStyle
}

/**
 * Parse a numeric attribute value
 */
const parseNum = (val: string | number | undefined, defaultVal: number = 0): number => {
  if (val === undefined) return defaultVal
  const parsed = parseFloat(val.toString())
  return isNaN(parsed) ? defaultVal : parsed
}

/**
 * Convert a single SVG primitive element to an SVG path `d` string
 *
 * Supported primitives:
 * - line: M x1 y1 L x2 y2
 * - rect: M x y H x+w V y+h H x Z
 * - circle: Two arc commands forming a complete circle
 * - ellipse: Two arc commands forming a complete ellipse
 * - polyline: M + L commands
 * - polygon: M + L commands + Z
 * - path: Returns the existing d attribute
 *
 * @param type - SVG element type (e.g., 'circle', 'rect')
 * @param attrs - Element attributes
 * @returns SVG path d string, or empty string if unsupported
 */
export const svgPrimitiveToPath = (type: string, attrs: SVGAttributes): string => {
  switch (type.toLowerCase()) {
    case 'line':
      return `M ${parseNum(attrs.x1)} ${parseNum(attrs.y1)} L ${parseNum(attrs.x2)} ${parseNum(attrs.y2)}`

    case 'rect': {
      const x = parseNum(attrs.x)
      const y = parseNum(attrs.y)
      const w = parseNum(attrs.width)
      const h = parseNum(attrs.height)
      // Note: rx/ry for rounded corners not yet supported
      return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`
    }

    case 'circle': {
      const cx = parseNum(attrs.cx)
      const cy = parseNum(attrs.cy)
      const r = parseNum(attrs.r)
      if (r <= 0) return ''
      // Two arcs (top half + bottom half) to form a complete circle
      // A rx ry x-rotation large-arc-flag sweep-flag x y
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
    }

    case 'ellipse': {
      const cx = parseNum(attrs.cx)
      const cy = parseNum(attrs.cy)
      const rx = parseNum(attrs.rx)
      const ry = parseNum(attrs.ry)
      if (rx <= 0 || ry <= 0) return ''
      // Two arcs forming a complete ellipse
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
    }

    case 'polyline':
    case 'polygon': {
      const pointsAttr = attrs.points?.toString().trim()
      if (!pointsAttr) return ''

      const points = pointsAttr.split(/[\s,]+/).map(Number)
      if (points.length < 4) return '' // Need at least 2 points (4 numbers)

      let d = `M ${points[0]} ${points[1]}`
      for (let i = 2; i < points.length; i += 2) {
        if (i + 1 < points.length) {
          d += ` L ${points[i]} ${points[i + 1]}`
        }
      }
      if (type.toLowerCase() === 'polygon') d += ' Z'
      return d
    }

    case 'path':
      return attrs.d?.toString() || ''

    default:
      console.warn(`[svg-to-edit2d] Unsupported SVG primitive type: ${type}`)
      return ''
  }
}

/**
 * Parse an SVG string and convert all drawable elements to Edit2D-ready paths
 *
 * @param svgString - Full SVG markup string
 * @returns Array of path data with styles
 */
export const convertSvgToPaths = (svgString: string): ConvertedPath[] => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')

  // Check for parse errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    console.warn('[svg-to-edit2d] SVG parse error:', parseError.textContent)
    return []
  }

  const elements = doc.querySelectorAll('line, rect, circle, ellipse, polyline, polygon, path')
  const results: ConvertedPath[] = []

  elements.forEach((el) => {
    const type = el.tagName.toLowerCase()
    const attrs: SVGAttributes = {}

    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i]
      attrs[attr.name] = attr.value
    }

    const d = svgPrimitiveToPath(type, attrs)
    if (d) {
      const fill = attrs.fill?.toString()
      const stroke = attrs.stroke?.toString()

      results.push({
        d,
        style: {
          strokeColor: stroke === 'none' ? null : (stroke || '#000000'),
          strokeWidth: parseNum(attrs['stroke-width'], 1),
          fillColor: fill === 'none' ? null : (fill || null),
          fillAlpha: fill === 'none' ? 0 : 1,
        },
      })
    }
  })

  return results
}

/**
 * Get the viewBox dimensions from an SVG string
 *
 * @param svgString - Full SVG markup string
 * @returns ViewBox dimensions or null if not found
 */
export const getSvgViewBox = (
  svgString: string
): { x: number; y: number; width: number; height: number } | null => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.querySelector('svg')

  if (!svgElement) return null

  const viewBox = svgElement.getAttribute('viewBox')
  if (!viewBox) {
    // Try width/height attributes
    const width = parseNum(svgElement.getAttribute('width') || '', 100)
    const height = parseNum(svgElement.getAttribute('height') || '', 100)
    return { x: 0, y: 0, width, height }
  }

  const [x, y, width, height] = viewBox.split(/[\s,]+/).map(Number)
  return { x: x || 0, y: y || 0, width: width || 100, height: height || 100 }
}

/**
 * Check if SVG has real-world mm units (data-unit="mm" attribute)
 */
export const isRealMmSvg = (svgString: string): boolean => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.querySelector('svg')
  return svgElement?.getAttribute('data-unit') === 'mm'
}
