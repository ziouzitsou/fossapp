/**
 * Product Type Definitions for FOSSAPP
 *
 * Defines TypeScript interfaces for lighting products based on the
 * ETIM (European Technical Information Model) classification standard.
 * These types mirror the `items.product_info` materialized view in Supabase.
 *
 * @remarks
 * ETIM is an open standard for classifying technical products in electrical
 * wholesale and manufacturing. Products have classes (EC), features (EF),
 * and feature groups (EFG).
 *
 * @module
 * @see {@link https://www.etim-international.com/} ETIM official documentation
 * @see {@link ../actions/index.ts} for product server actions
 */

/**
 * Product display template type.
 *
 * @remarks
 * Determines which UI template to use when rendering product details.
 * Each template highlights different features based on product type.
 */
export type TemplateType = 'luminaire' | 'accessory' | 'lightline' | 'generic'

/**
 * Lightweight product type optimized for search results and listings.
 *
 * @remarks
 * Contains only essential fields needed for list/card display.
 * Use {@link ProductInfo} for full product details.
 */
export interface ProductSearchResult {
  /** UUID from items.product_info */
  product_id: string
  /** FOSS product identifier (e.g., "FLMR-001") */
  foss_pid: string
  /** Short marketing description */
  description_short: string
  /** Supplier/manufacturer name */
  supplier_name: string
  /** Recent pricing data for display */
  prices: Array<{
    /** Price list date (ISO 8601) */
    date: string
    /** Discount tier 1 percentage */
    disc1: number
    /** Base/list price */
    start_price: number
  }>
}

/**
 * Complete product data from the items.product_info materialized view.
 *
 * @remarks
 * This is the primary product interface used throughout the application.
 * Contains ETIM classification, pricing history, multimedia, and all
 * technical features.
 */
export interface ProductInfo {
  // ===== Core Identification =====
  /** UUID primary key from items.product_info */
  product_id: string
  /** FOSS product code (e.g., "DT102149200B") */
  foss_pid: string
  /** Foreign key to catalog table */
  catalog_id: number
  /** Catalog version string */
  catalog_version: string

  // ===== Product Details =====
  /** Short marketing description (1-2 lines) */
  description_short: string
  /** Extended product description */
  description_long: string
  /** Manufacturer's own product number */
  manufacturer_pid: string
  /** Product family (e.g., "CORE LINE DOWNLIGHT") */
  family: string
  /** Product subfamily for finer categorization */
  subfamily: string

  // ===== ETIM Classification =====
  /** ETIM class ID (e.g., "EC002892" for ceiling luminaires) */
  class: string
  /** Human-readable ETIM class name */
  class_name: string
  /** ETIM group ID (e.g., "EG000027" for luminaires) */
  group: string
  /** Human-readable ETIM group name */
  group_name: string

  // ===== Supplier =====
  /** Supplier/manufacturer company name */
  supplier_name: string
  /** URL to supplier logo (light theme) */
  supplier_logo: string
  /** URL to supplier logo (dark theme) */
  supplier_logo_dark: string

  // ===== JSONB Arrays =====
  /** Historical pricing data from price lists */
  prices: Price[]
  /** Images, drawings, documents per BMEcat standard */
  multimedia: Multimedia[]
  /** All ETIM technical features */
  features: Feature[]
}

/**
 * Product pricing data from supplier price lists.
 *
 * @remarks
 * Prices are stored historically - the most recent date is the current price.
 * Discount tiers (disc1-3) are percentages applied by customer segment.
 */
export interface Price {
  /** Base/list price in catalog currency */
  start_price: number
  /** Discount tier 1 percentage (typical wholesaler) */
  disc1: number
  /** Discount tier 2 percentage (volume buyer) */
  disc2: number
  /** Discount tier 3 percentage (special accounts) */
  disc3: number
  /** Price list effective date (ISO 8601) */
  date: string
}

/**
 * Multimedia resource reference per BMEcat standard.
 *
 * @remarks
 * BMEcat defines MIME codes for different media types.
 * See {@link MIME_CODES} for the full list of supported codes.
 */
export interface Multimedia {
  /** BMEcat MIME type code (e.g., MD01, MD12, MD16) */
  mime_code: string
  /** URL to the media resource */
  mime_source: string
}

/**
 * BMEcat MIME code definitions for product media.
 *
 * @remarks
 * Codes MD01-MD22 are standard BMEcat codes from supplier catalogs.
 * Codes MD02, MD19, MD47, MD64 are FOSSAPP-generated derivatives stored
 * in Supabase Storage (bmecat-media bucket).
 */
export const MIME_CODES = {
  // ===== Supplier-Provided (External URLs) =====
  /** Product photographs (high-res) */
  MD01: 'Product photographs',
  /** Link to manufacturer's product page */
  MD04: 'Manufacturer product page',
  /** Technical drawings (SVG, DWG, CAD formats) */
  MD12: 'Technical drawings (SVG/CAD)',
  /** Installation manuals and documentation (PDF) */
  MD14: 'Installation manuals (PDF)',
  /** Light distribution curves (IES/LDT photometric files) */
  MD16: 'Light distribution curves (IES/LDT)',
  /** Product specification sheets */
  MD22: 'Specification sheets',

  // ===== FOSSAPP-Generated (Supabase Storage) =====
  /** Print-ready image derived from MD01, 591×591px @300dpi */
  MD02: 'Print-ready image',
  /** LDC polar diagram PNG derived from MD16, optimized for display */
  MD19: 'LDC diagram (PNG)',
  /** Thumbnail derived from MD01, for product lists */
  MD47: 'Thumbnail',
  /** Line drawing derived from MD12, 591×591px @300dpi, black on white */
  MD64: 'Line drawing',
} as const

/**
 * ETIM technical feature with value and unit information.
 *
 * @remarks
 * ETIM features have different value types: alphanumeric (fvalueC),
 * numeric (fvalueN), range (fvalueR), or boolean (fvalueB).
 * Only ONE value field will be populated per feature.
 *
 * The SORTNR field indicates ETIM's recommended display order -
 * lower numbers are more important and should appear first.
 */
export interface Feature {
  /** ETIM feature ID (e.g., "EF000001" for Rated voltage) */
  FEATUREID: string
  /** Human-readable feature name */
  feature_name: string
  /** ETIM feature group ID (e.g., "EFG00007" for Electrical) */
  FEATUREGROUPID: string
  /** Feature group description */
  FEATUREGROUPDESC: string
  /** ETIM display priority (lower = more important, null = unranked) */
  SORTNR: number | null

  // ===== Value Fields (mutually exclusive) =====
  /** Alphanumeric ETIM value ID (e.g., "EV000007") */
  fvalueC: string | null
  /** Translated alphanumeric value (e.g., "220-240V") */
  fvalueC_desc: string | null
  /** Numeric value (e.g., 15.5 for wattage) */
  fvalueN: number | null
  /** Range value as PostgreSQL numrange string (e.g., "[2700,6500]") */
  fvalueR: string | null
  /** Boolean value (true/false features) */
  fvalueB: boolean | null

  /** Additional value details or notes */
  fvalue_detail: string | null

  // ===== Unit Information (for numeric/range values) =====
  /** ETIM unit ID */
  unit: string | null
  /** Full unit description */
  unit_desc: string | null
  /** Unit abbreviation for display (W, V, mm, lm, K, kg, etc.) */
  unit_abbrev: string | null
}

/**
 * UI configuration for displaying ETIM feature groups.
 *
 * @remarks
 * Used by product detail pages to group features with icons and colors.
 */
export interface FeatureGroupConfig {
  /** ETIM feature group ID (e.g., "EFG00007") */
  id: string
  /** Display name for the group */
  name: string
  /** Lucide icon name for the group header */
  icon: string
  /** Tailwind color class for the group */
  color: string
  /** Display order (lower = higher priority) */
  priority: number
}

/**
 * All 18 ETIM feature group definitions.
 *
 * @remarks
 * Maps ETIM group IDs to human-readable names.
 * Groups are standardized across all ETIM-classified products.
 */
export const ETIM_FEATURE_GROUPS: Record<string, string> = {
  'EFG00001': 'Application',
  'EFG00002': 'Approval/certification',
  'EFG00003': 'Colour',
  'EFG00004': 'Communication',
  'EFG00005': 'Connection',
  'EFG00006': 'Consumption',
  'EFG00007': 'Electrical',
  'EFG00008': 'Energy efficiency/environmental',
  'EFG00010': 'Material',
  'EFG00011': 'Measurements',
  'EFG00012': 'Model/type',
  'EFG00013': 'Mounting/installation',
  'EFG00014': 'Operating conditions',
  'EFG00015': 'Options',
  'EFG00016': 'Other',
  'EFG00017': 'Performance',
  'EFG00018': 'Protection',
  'EFG00019': 'Setting/control'
}

/**
 * Product count distribution by ETIM class.
 *
 * @remarks
 * Reference data showing product counts per class in the FOSSAPP database.
 * Useful for understanding catalog composition and prioritizing features.
 * Top classes are luminaires (EG000027) and accessories (EG000030).
 */
export const PRODUCT_DISTRIBUTION = {
  'EC001744': { count: 5794, name: 'Downlight/spot/floodlight', group: 'EG000027' },
  'EC000986': { count: 3692, name: 'Electrical unit for light-line system', group: 'EG000027' },
  'EC002892': { count: 1566, name: 'Ceiling-/wall luminaire', group: 'EG000027' },
  'EC001743': { count: 1090, name: 'Pendant luminaire', group: 'EG000027' },
  'EC002557': { count: 543,  name: 'Mechanical accessories/spare parts', group: 'EG000030' },
  'EC000758': { count: 452,  name: 'In-ground luminaire', group: 'EG000027' },
  'EC000109': { count: 246,  name: 'Batten luminaire', group: 'EG000027' },
  'EC000301': { count: 222,  name: 'Luminaire bollard', group: 'EG000027' },
  'EC002558': { count: 221,  name: 'Light technical accessories', group: 'EG000030' },
  'EC002556': { count: 211,  name: 'Electrical accessories', group: 'EG000030' },
  'EC000293': { count: 190,  name: 'Support profile light-line system', group: 'EG000030' },
  'EC000481': { count: 85,   name: 'Orientation luminaire', group: 'EG000027' },
  'EC002710': { count: 83,   name: 'LED driver', group: 'EG000030' },
  'EC004966': { count: 65,   name: 'Profile for light ribbon', group: 'EG000030' },
  'EC000062': { count: 60,   name: 'Luminaire for streets and places', group: 'EG000027' },
  'EC000533': { count: 60,   name: 'Lighting control system component', group: 'EG000030' },
  'EC000101': { count: 59,   name: 'Light-track', group: 'EG000030' },
  'EC000300': { count: 56,   name: 'Floor luminaire', group: 'EG000027' },
  'EC002706': { count: 56,   name: 'Light ribbon/-hose/-strip', group: 'EG000027' },
  'EC000061': { count: 44,   name: 'Light pole', group: 'EG000030' }
}
