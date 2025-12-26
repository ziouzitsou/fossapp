/**
 * @fossapp/tiles/types
 * Types for tile generation workflow
 */

// Product from items.product_info materialized view
export interface ProductInfo {
  product_id: string
  foss_pid: string
  catalog_id: number
  catalog_version: string
  description_short: string
  description_long: string
  manufacturer_pid: string
  family: string
  subfamily: string
  class: string
  class_name: string
  group: string
  group_name: string
  supplier_name: string
  supplier_logo: string
  supplier_logo_dark: string
  prices: ProductPrice[]
  multimedia: MultimediaItem[]
  features: ProductFeature[]
}

export interface ProductPrice {
  date: string
  disc1: number
  disc2: number
  disc3: number
  start_price: number
}

export interface MultimediaItem {
  mime_code: string // MD01/MD02 = image, MD12/MD64 = drawing, MD04 = deeplink, MD16/MD19 = LDC, MD47 = thumbnail
  mime_source: string
}

export interface ProductFeature {
  FEATUREID: string
  feature_name: string
  fvalueB: boolean | null
  fvalueC: string | null
  fvalueC_desc: string | null
  fvalueN: number | null
  fvalueR: string | null // Range like "[100.0,280.0]"
  unit: string | null
  unit_abbrev: string | null
  unit_desc: string | null
  FEATUREGROUPID: string
  FEATUREGROUPDESC: string
  fvalue_detail: string | null
}

// Bucket item - product selected for tile creation
export interface BucketItem {
  product: ProductInfo
  addedAt: Date
}

// Tile member for the final JSON payload
export interface TileMember {
  productId: string
  imageFilename: string
  drawingFilename: string
  tileText: string
  width: number
  height: number
  dpi: number
  tileWidth: number
  tileHeight: number
}

// Tile group - contains multiple members
export interface TileGroup {
  id: string
  name: string
  members: BucketItem[]
  memberTexts?: Record<string, string> // productId -> custom text
}

// Helper to extract multimedia URLs
// Prioritizes generated Supabase Storage URLs (MD02, MD64, MD47) over supplier URLs (MD01, MD12)

export function getProductImage(product: ProductInfo): string | undefined {
  // MD02 (print-ready) preferred, fallback to MD01 (supplier photo)
  return product.multimedia?.find(m => m.mime_code === 'MD02')?.mime_source
    || product.multimedia?.find(m => m.mime_code === 'MD01')?.mime_source
}

export function getProductDrawing(product: ProductInfo): string | undefined {
  // MD64 (line drawing) preferred, fallback to MD12 (supplier drawing)
  return product.multimedia?.find(m => m.mime_code === 'MD64')?.mime_source
    || product.multimedia?.find(m => m.mime_code === 'MD12')?.mime_source
}

// Get thumbnail for product lists/grids
export function getProductThumbnail(product: ProductInfo): string | undefined {
  // MD47 (thumbnail) preferred, fallback to MD02/MD01
  return product.multimedia?.find(m => m.mime_code === 'MD47')?.mime_source
    || getProductImage(product)
}

// Get LDC diagram
export function getProductLDC(product: ProductInfo): string | undefined {
  // MD19 (generated PNG) preferred, fallback to MD16 (supplier SVG)
  return product.multimedia?.find(m => m.mime_code === 'MD19')?.mime_source
    || product.multimedia?.find(m => m.mime_code === 'MD16')?.mime_source
}

export function getProductDeeplink(product: ProductInfo): string | undefined {
  return product.multimedia?.find(m => m.mime_code === 'MD04')?.mime_source
}
