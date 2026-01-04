/**
 * Edit2D Markers - Type definitions and constants
 *
 * Contains interfaces for marker data and callbacks, plus unit conversion constants.
 */

// Supabase storage URL for product symbols
export const SYMBOLS_BUCKET_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-symbols`

// Unit conversion constants
export const MM_TO_METERS = 0.001

// Default circle marker size when no SVG symbol available
export const DEFAULT_MARKER_RADIUS_MM = 50 // 50mm radius = 100mm diameter

/**
 * Data associated with each placed marker
 */
export interface Edit2DMarkerData {
  id: string
  productId: string
  projectProductId: string
  productName: string
  fossPid?: string      // FOSS product ID for symbol lookup
  symbol?: string       // Symbol label (e.g., "A1", "B2")
  pageX: number         // Edit2D page X coordinate
  pageY: number         // Edit2D page Y coordinate
  rotation: number      // Rotation in degrees (0-360)
}

/**
 * Callbacks for marker events
 */
export interface Edit2DMarkerCallbacks {
  onSelect?: (id: string | null) => void
  onDelete?: (id: string) => void
  onRotate?: (id: string, rotation: number) => void
  onMove?: (id: string, pageX: number, pageY: number) => void
}

/**
 * Unit scaling factors for proper symbol sizing
 */
export interface UnitScales {
  modelUnitScale: number      // meters=1, mm=0.001
  pageToModelScale: number    // from getPageToModelTransform
}
