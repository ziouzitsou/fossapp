/**
 * Filter component type definitions
 * Based on ETIM feature types: L (Logical/Boolean), A (Alphanumeric), N (Numeric), R (Range)
 */

export type FilterType = 'boolean' | 'multi-select' | 'numeric' | 'range'

export interface FilterFacet {
  filter_key: string
  filter_label: string
  filter_category: string
  filter_value: string
  product_count: number
  min_numeric_value?: number
  max_numeric_value?: number
}

export interface FilterDefinition {
  filter_key: string
  label: string
  filter_type: FilterType
  etim_feature_type?: string  // A, L, N, or R from ETIM
  ui_config: {
    filter_category: string
    min?: number
    max?: number
    step?: number
    unit?: string
    show_count?: boolean
    sort_by?: string
    searchable?: boolean
    show_icons?: boolean
    color_swatches?: boolean
    presets?: Preset[]
  }
  display_order: number
}

export interface Preset {
  label: string
  min: number
  max: number
  description?: string
}

export interface BaseFilterProps {
  filterKey: string
  label: string
  etimFeatureType?: string  // A, L, N, or R
  onClear?: () => void
  showClearButton?: boolean
}

export interface BooleanFilterProps extends BaseFilterProps {
  value: boolean | null
  onChange: (value: boolean) => void
  facets: FilterFacet[]
  showCount?: boolean
}

export interface MultiSelectFilterProps extends BaseFilterProps {
  values: string[]
  onChange: (values: string[]) => void
  facets: FilterFacet[]
  options?: {
    searchable?: boolean
    maxHeight?: string
    showCount?: boolean
    showIcons?: boolean
    colorSwatches?: boolean
  }
}

export interface NumericFilterProps extends BaseFilterProps {
  value: number | null
  onChange: (value: number | null) => void
  unit?: string
  min?: number
  max?: number
  step?: number
  placeholder?: string
}

export interface RangeFilterProps extends BaseFilterProps {
  value: { min?: number; max?: number }
  onChange: (value: { min?: number; max?: number }) => void
  unit?: string
  minBound?: number
  maxBound?: number
  step?: number
  presets?: Preset[]
  showHistogram?: boolean
  facets?: FilterFacet[]
}

export interface FilterCategoryProps {
  label: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}
