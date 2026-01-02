/**
 * Tile Generation Types and Utilities
 *
 * Defines types for the tile generation workflow - creating grouped product
 * layouts for print catalogs and AutoCAD drawings. Also provides helper
 * functions to extract the best available multimedia URLs for products.
 *
 * @remarks
 * The tile workflow involves:
 * 1. User selects products into a "bucket"
 * 2. Products are organized into tile groups
 * 3. Groups are sent to the script generator (see scripts/index.ts)
 * 4. AutoCAD/APS processes the script to create DWG output
 *
 * @module
 * @see {@link ../scripts/index.ts} for script generation
 * @see {@link ../progress/progress-store.ts} for job tracking
 */

// ============================================================================
// PRODUCT TYPES (from items.product_info)
// ============================================================================

/**
 * Product data for tile generation, from items.product_info view.
 *
 * @remarks
 * This is a local copy of the type to avoid circular dependencies.
 * Use @fossapp/products/types for the canonical definition.
 */
export interface ProductInfo {
  /** UUID primary key */
  product_id: string
  /** FOSS product code */
  foss_pid: string
  /** Catalog reference */
  catalog_id: number
  /** Catalog version string */
  catalog_version: string
  /** Short description */
  description_short: string
  /** Long description */
  description_long: string
  /** Manufacturer's product number */
  manufacturer_pid: string
  /** Product family */
  family: string
  /** Product subfamily */
  subfamily: string
  /** ETIM class ID */
  class: string
  /** ETIM class name */
  class_name: string
  /** ETIM group ID */
  group: string
  /** ETIM group name */
  group_name: string
  /** Supplier name */
  supplier_name: string
  /** Supplier logo URL (light theme) */
  supplier_logo: string
  /** Supplier logo URL (dark theme) */
  supplier_logo_dark: string
  /** Pricing history */
  prices: ProductPrice[]
  /** Images, drawings, documents */
  multimedia: MultimediaItem[]
  /** ETIM technical features */
  features: ProductFeature[]
}

/**
 * Product pricing data.
 */
export interface ProductPrice {
  /** Price effective date */
  date: string
  /** Discount tier 1 percentage */
  disc1: number
  /** Discount tier 2 percentage */
  disc2: number
  /** Discount tier 3 percentage */
  disc3: number
  /** Base/list price */
  start_price: number
}

/**
 * Multimedia resource reference.
 *
 * @remarks
 * MIME codes indicate content type:
 * - MD01/MD02: Product photos
 * - MD12/MD64: Technical drawings
 * - MD04: Manufacturer deep link
 * - MD16/MD19: Light distribution curves (LDC)
 * - MD47: Thumbnails
 */
export interface MultimediaItem {
  /** BMEcat MIME code identifying content type */
  mime_code: string
  /** URL to the media resource */
  mime_source: string
}

/**
 * ETIM product feature.
 */
export interface ProductFeature {
  /** ETIM feature ID */
  FEATUREID: string
  /** Feature display name */
  feature_name: string
  /** Boolean value */
  fvalueB: boolean | null
  /** Alphanumeric code */
  fvalueC: string | null
  /** Alphanumeric description */
  fvalueC_desc: string | null
  /** Numeric value */
  fvalueN: number | null
  /** Range value (e.g., "[100.0,280.0]") */
  fvalueR: string | null
  /** Unit code */
  unit: string | null
  /** Unit abbreviation (W, mm, lm, etc.) */
  unit_abbrev: string | null
  /** Unit description */
  unit_desc: string | null
  /** Feature group ID */
  FEATUREGROUPID: string
  /** Feature group description */
  FEATUREGROUPDESC: string
  /** Additional value details */
  fvalue_detail: string | null
}

// ============================================================================
// TILE WORKFLOW TYPES
// ============================================================================

/**
 * A product in the user's selection bucket, awaiting grouping.
 */
export interface BucketItem {
  /** Full product data */
  product: ProductInfo
  /** When product was added to bucket */
  addedAt: Date
}

/**
 * A single member within a tile group, ready for script generation.
 *
 * @remarks
 * Contains resolved filenames and dimensions for AutoCAD insertion.
 * Matches the interface expected by the script generator.
 */
export interface TileMember {
  /** Product UUID */
  productId: string
  /** Resolved image filename/URL */
  imageFilename: string
  /** Resolved drawing filename/URL */
  drawingFilename: string
  /** Text label to display beside the tile */
  tileText: string
  /** Source image width in pixels */
  width: number
  /** Source image height in pixels */
  height: number
  /** Image resolution */
  dpi: number
  /** Target width in AutoCAD (mm) */
  tileWidth: number
  /** Target height in AutoCAD (mm) */
  tileHeight: number
}

/**
 * A group of products that will be laid out together in one tile.
 */
export interface TileGroup {
  /** Unique group identifier */
  id: string
  /** Display name for the tile */
  name: string
  /** Products in this group */
  members: BucketItem[]
  /** Custom text overrides by product ID */
  memberTexts?: Record<string, string>
}

// ============================================================================
// MULTIMEDIA HELPER FUNCTIONS
// ============================================================================

/**
 * Gets the best available product image URL.
 *
 * @remarks
 * Prioritizes FOSSAPP-generated MD02 (print-ready) over supplier MD01.
 *
 * @param product - Product to get image for
 * @returns Image URL or undefined if none available
 */
export function getProductImage(product: ProductInfo): string | undefined {
  return product.multimedia?.find(m => m.mime_code === 'MD02')?.mime_source
    || product.multimedia?.find(m => m.mime_code === 'MD01')?.mime_source
}

/**
 * Gets the best available technical drawing URL.
 *
 * @remarks
 * Prioritizes FOSSAPP-generated MD64 (line drawing) over supplier MD12.
 *
 * @param product - Product to get drawing for
 * @returns Drawing URL or undefined if none available
 */
export function getProductDrawing(product: ProductInfo): string | undefined {
  return product.multimedia?.find(m => m.mime_code === 'MD64')?.mime_source
    || product.multimedia?.find(m => m.mime_code === 'MD12')?.mime_source
}

/**
 * Gets the best available thumbnail URL for list/grid views.
 *
 * @remarks
 * Prioritizes MD47 (thumbnail), falls back to product image.
 *
 * @param product - Product to get thumbnail for
 * @returns Thumbnail URL or undefined if none available
 */
export function getProductThumbnail(product: ProductInfo): string | undefined {
  return product.multimedia?.find(m => m.mime_code === 'MD47')?.mime_source
    || getProductImage(product)
}

/**
 * Gets the best available light distribution curve (LDC) URL.
 *
 * @remarks
 * Prioritizes FOSSAPP-generated MD19 (PNG) over supplier MD16 (SVG/IES).
 *
 * @param product - Product to get LDC for
 * @returns LDC URL or undefined if none available
 */
export function getProductLDC(product: ProductInfo): string | undefined {
  return product.multimedia?.find(m => m.mime_code === 'MD19')?.mime_source
    || product.multimedia?.find(m => m.mime_code === 'MD16')?.mime_source
}

/**
 * Gets the manufacturer's product page deep link.
 *
 * @param product - Product to get deep link for
 * @returns Manufacturer URL or undefined if none available
 */
export function getProductDeeplink(product: ProductInfo): string | undefined {
  return product.multimedia?.find(m => m.mime_code === 'MD04')?.mime_source
}
