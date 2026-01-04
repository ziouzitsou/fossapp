/**
 * Utility to convert SVG primitives into SVG Path strings ('d' attribute).
 * This allows Autodesk APS Viewer's Edit2D extension to import non-path shapes.
 */

export interface SVGAttributes {
  [key: string]: string | number;
}

export const svgPrimitiveToPath = (type: string, attrs: SVGAttributes): string => {
  const n = (val: string | number) => parseFloat(val.toString());

  switch (type.toLowerCase()) {
    case 'line':
      return `M ${n(attrs.x1)} ${n(attrs.y1)} L ${n(attrs.x2)} ${n(attrs.y2)}`;

    case 'rect': {
      const x = n(attrs.x || 0);
      const y = n(attrs.y || 0);
      const w = n(attrs.width);
      const h = n(attrs.height);
      // Optional: handle rx/ry for rounded rects if needed
      return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    }

    case 'circle': {
      const cx = n(attrs.cx);
      const cy = n(attrs.cy);
      const r = n(attrs.r);
      // Two arcs to form a circle
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }

    case 'ellipse': {
      const cx = n(attrs.cx);
      const cy = n(attrs.cy);
      const rx = n(attrs.rx);
      const ry = n(attrs.ry);
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }

    case 'polyline':
    case 'polygon': {
      if (!attrs.points) return '';
      const points = attrs.points.toString().trim().split(/[\s,]+/).map(Number);
      if (points.length < 2) return '';
      
      let d = `M ${points[0]} ${points[1]}`;
      for (let i = 2; i < points.length; i += 2) {
        d += ` L ${points[i]} ${points[i + 1]}`;
      }
      if (type.toLowerCase() === 'polygon') d += ' Z';
      return d;
    }

    case 'path':
      return attrs.d?.toString() || '';

    default:
      console.warn(`Unsupported SVG primitive type: ${type}`);
      return '';
  }
};

/**
 * Parses an entire SVG string and converts all compatible elements to Edit2D-ready paths.
 */
export const convertSvgToPaths = (svgString: string): { d: string, style: any }[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const elements = doc.querySelectorAll('line, rect, circle, ellipse, polyline, polygon, path');
  
  const results: { d: string, style: any }[] = [];

  elements.forEach((el) => {
    const type = el.tagName.toLowerCase();
    const attrs: SVGAttributes = {};
    
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      attrs[attr.name] = attr.value;
    }

    const d = svgPrimitiveToPath(type, attrs);
    if (d) {
      results.push({
        d,
        style: {
          strokeColor: attrs.stroke || '#000000',
          strokeWidth: n(attrs['stroke-width'] || 1),
          fillColor: attrs.fill === 'none' ? null : (attrs.fill || '#000000'),
          fillAlpha: attrs.fill === 'none' ? 0 : 1
        }
      });
    }
  });

  return results;
};

const n = (val: string | number) => parseFloat(val.toString());
