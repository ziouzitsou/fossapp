/**
 * Advanced Search Types
 * Types matching the actual Supabase search schema functions
 */

// Filter object structure (passed as JSONB to search functions)
export interface SearchFilters {
  query?: string
  filters?: Record<string, unknown> // JSONB filters object
  categories?: string[] // taxonomy_codes
  suppliers?: string[]
  // Boolean flags
  indoor?: boolean
  outdoor?: boolean
  submersible?: boolean
  trimless?: boolean
  cutShapeRound?: boolean
  cutShapeRectangular?: boolean
  // Pagination & sorting
  sortBy?: 'relevance' | 'name' | 'price_asc' | 'price_desc' | 'newest'
  limit?: number
  page?: number
}

// Product result from search
export interface SearchProduct {
  product_id: string
  foss_pid: string
  description_short: string
  description_long?: string
  supplier_name: string
  taxonomy_code?: string
  taxonomy_name?: string
  // Prices
  price_eur?: number
  price_usd?: number
  // Multimedia
  image_url?: string
  datasheet_url?: string
  // Features (JSONB)
  features?: Record<string, unknown>
  // Boolean flags
  indoor?: boolean
  outdoor?: boolean
  submersible?: boolean
  trimless?: boolean
  cut_shape_round?: boolean
  cut_shape_rectangular?: boolean
  // Metadata
  relevance_score?: number
}

// Taxonomy node structure
export interface TaxonomyNode {
  code: string
  name: string
  parent_code: string | null
  level: number
  description?: string | null
  icon?: string | null
  display_order?: number
  children?: TaxonomyNode[]
}

// Filter facet (for dynamic filter counts)
export interface FilterFacet {
  filter_name: string
  filter_type: string
  value: string
  count: number
}

// Dynamic facet response
export interface DynamicFacet {
  feature_code: string
  feature_name: string
  value_code: string
  value_name: string
  unit?: string
  count: number
}

// Search statistics
export interface SearchStatistics {
  total_products: number
  suppliers: Array<{
    supplier_name: string
    count: number
  }>
  categories: Array<{
    taxonomy_code: string
    taxonomy_name: string
    count: number
  }>
}

// Filter definition from database (search.filter_definitions)
export interface FilterDefinition {
  id: number
  filter_key: string
  filter_type: 'boolean' | 'range' | 'categorical'
  label: string
  group: 'Location' | 'Options' | 'Electricals' | 'Design' | 'Light'
  etim_feature_id: string
  etim_unit_id?: string
  display_order: number
  ui_component?: string
  ui_config?: Record<string, unknown>
  applicable_taxonomy_codes?: string[]
  active: boolean
}
