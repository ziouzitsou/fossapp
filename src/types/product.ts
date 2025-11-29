// Product Display System Type Definitions
// Based on ETIM (European Technical Information Model) standards

export type TemplateType = 'luminaire' | 'accessory' | 'lightline' | 'generic';

/**
 * Lightweight product type for search results
 * Contains only essential fields for listing display
 */
export interface ProductSearchResult {
  product_id: string
  foss_pid: string
  description_short: string
  supplier_name: string
  prices: Array<{
    date: string
    disc1: number
    start_price: number
  }>
}

// Main product interface matching items.product_info materialized view
export interface ProductInfo {
  // Core identification
  product_id: string;          // UUID
  foss_pid: string;            // Foss SA part number (e.g., "DT102149200B")
  catalog_id: number;
  catalog_version: string;

  // Product details
  description_short: string;
  description_long: string;
  manufacturer_pid: string;    // Supplier's part number
  family: string;              // Product family
  subfamily: string;           // Product subfamily

  // ETIM classification
  class: string;               // ETIM class ID (e.g., "EC002892")
  class_name: string;          // Human-readable class name
  group: string;               // ETIM group ID (e.g., "EG000027")
  group_name: string;          // Human-readable group name

  // Supplier
  supplier_name: string;
  supplier_logo: string;       // URL to logo (light mode)
  supplier_logo_dark: string;  // URL to logo (dark mode)

  // JSONB Arrays
  prices: Price[];             // Historical pricing data
  multimedia: Multimedia[];    // Images, drawings, documents
  features: Feature[];         // All ETIM features
}

// Price structure for pricing history
export interface Price {
  start_price: number;         // Base price
  disc1: number;               // Discount tier 1 (percentage)
  disc2: number;               // Discount tier 2
  disc3: number;               // Discount tier 3
  date: string;                // ISO date string
}

// Multimedia resource types
export interface Multimedia {
  mime_code: string;           // MD01, MD12, MD14, MD16, MD22, MD04
  mime_source: string;         // URL to resource
}

// MIME Code Reference
export const MIME_CODES = {
  MD01: 'Product photographs',
  MD12: 'Technical drawings (SVG/CAD)',
  MD14: 'Installation manuals (PDF)',
  MD16: 'Light distribution curves (IES/LDT)',
  MD22: 'Specification sheets',
  MD04: 'Manufacturer product page'
} as const;

// ETIM Feature structure
export interface Feature {
  FEATUREID: string;           // ETIM feature ID (e.g., "EF000001")
  feature_name: string;        // Human-readable name
  FEATUREGROUPID: string;      // ETIM feature group (e.g., "EFG00007")
  FEATUREGROUPDESC: string;    // Group description (e.g., "Electrical")

  // Value fields (only ONE will be populated based on feature type)
  fvalueC: string | null;      // Alphanumeric ETIM value ID
  fvalueC_desc: string | null; // Translated alphanumeric value
  fvalueN: number | null;      // Numeric value
  fvalueR: string | null;      // Range value (PostgreSQL numrange as string)
  fvalueB: boolean | null;     // Boolean value

  fvalue_detail: string | null; // Additional details

  // Unit information (for numeric/range values)
  unit: string | null;         // ETIM unit ID
  unit_desc: string | null;    // Unit description
  unit_abbrev: string | null;  // Unit abbreviation (W, V, mm, lm, K, etc.)
}

// Feature group configuration for display
export interface FeatureGroupConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  priority: number;
}

// All 18 ETIM feature groups
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
};

// Product distribution by class (for reference)
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
};