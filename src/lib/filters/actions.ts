'use server'
import { supabaseServer } from '@/lib/supabase-server'

export interface FilterDefinition {
  id: number
  filter_key: string
  filter_type: 'range' | 'categorical' | 'boolean'
  label: string
  group: string
  etim_feature_id: string
  etim_unit_id: string | null
  display_order: number
  ui_config: {
    icon?: string
    min?: number
    max?: number
    step?: number
    unit?: string
    options?: Array<{ value: string; label: string }>
    labels?: Record<string, string>
    description?: string
    help_text?: string
  }
  active: boolean
}

export interface FilterGroup {
  name: string
  filters: FilterDefinition[]
}

/**
 * Fetch all active filter definitions grouped by category.
 * Uses hierarchical lookup - filters applicable to parent categories
 * are inherited by child categories (e.g., LUMINAIRE filters appear for LUMINAIRE-CEILING).
 */
export async function getFilterDefinitionsAction(
  taxonomyCode?: string
): Promise<FilterGroup[]> {
  try {
    let data, error

    if (taxonomyCode) {
      // Use hierarchical RPC function that walks up the taxonomy tree
      // This ensures LUMINAIRE-CEILING inherits filters from LUMINAIRE
      const result = await supabaseServer
        .schema('search')
        .rpc('get_filters_for_taxonomy', { p_taxonomy_code: taxonomyCode })
      data = result.data
      error = result.error
    } else {
      // No taxonomy - get all active filters
      const result = await supabaseServer
        .schema('search')
        .from('filter_definitions')
        .select('*')
        .eq('active', true)
        .order('display_order')
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Failed to fetch filter definitions:', error)
      return []
    }

    // Group by filter group and track minimum display_order per group
    const groups = new Map<string, { filters: FilterDefinition[], minOrder: number }>()

    data?.forEach((filter: FilterDefinition) => {
      const group = filter.group || 'Other'
      if (!groups.has(group)) {
        groups.set(group, { filters: [], minOrder: filter.display_order })
      }
      const groupData = groups.get(group)!
      groupData.filters.push(filter)
      // Update min order if this filter has a lower display_order
      if (filter.display_order < groupData.minOrder) {
        groupData.minOrder = filter.display_order
      }
    })

    // Convert to array format, sorted by minimum display_order of each group
    const result: FilterGroup[] = Array.from(groups.entries())
      .sort(([, a], [, b]) => a.minOrder - b.minOrder)
      .map(([name, { filters }]) => ({
        name,
        filters
      }))

    return result
  } catch (error) {
    console.error('Error fetching filter definitions:', error)
    return []
  }
}

/**
 * Get available filter values for categorical filters
 * Fetches distinct values from product_feature table
 */
export async function getFilterValuesAction(
  filterKey: string,
  etimFeatureId: string,
  taxonomyCode?: string
): Promise<Array<{ value: string; label: string; count?: number }>> {
  try {
    // For FLAG- features (derived from text patterns)
    if (etimFeatureId.startsWith('FLAG-')) {
      // These are boolean flags, return yes/no options
      return [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' }
      ]
    }

    // For ETIM features, query product_feature table
    // If taxonomy code provided, we need to use a more efficient query
    // to avoid "Bad Request" errors from large .in() arrays

    let data, error

    if (taxonomyCode) {
      // Use RPC function or raw SQL to avoid .in() with large arrays
      // For now, return empty array as filters are complex and need proper implementation
      // TODO: Implement proper filter queries with JOIN or EXISTS
      return []
    } else {
      // No taxonomy filtering - get all values
      const result = await supabaseServer
        .schema('items')
        .from('product_feature')
        .select('fvaluec, fvaluen')
        .eq('fname_id', etimFeatureId)

      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Failed to fetch filter values:', error)
      return []
    }

    // Get distinct values
    const valueSet = new Set<string>()
    data?.forEach((item) => {
      if (item.fvaluec) valueSet.add(item.fvaluec)
      if (item.fvaluen) valueSet.add(item.fvaluen.toString())
    })

    // Convert to array with labels
    return Array.from(valueSet).map(value => ({
      value,
      label: value // TODO: Could fetch from etim.value table for better labels
    })).sort((a, b) => a.label.localeCompare(b.label))

  } catch (error) {
    console.error('Error fetching filter values:', error)
    return []
  }
}

/**
 * Get min/max range for range filters
 */
export async function getFilterRangeAction(
  etimFeatureId: string,
  taxonomyCode?: string
): Promise<{ min: number; max: number } | null> {
  try {
    // If taxonomy code provided, we need to use a more efficient query
    // to avoid "Bad Request" errors from large .in() arrays

    let data, error

    if (taxonomyCode) {
      // Use RPC function or raw SQL to avoid .in() with large arrays
      // For now, return null as filters are complex and need proper implementation
      // TODO: Implement proper filter queries with JOIN or EXISTS
      return null
    } else {
      // No taxonomy filtering - get all values
      const result = await supabaseServer
        .schema('items')
        .from('product_feature')
        .select('fvaluen, fvaluer')
        .eq('fname_id', etimFeatureId)

      data = result.data
      error = result.error
    }

    if (error || !data || data.length === 0) {
      return null
    }

    // Extract numeric values
    const values: number[] = []
    data.forEach((item) => {
      if (item.fvaluen) values.push(item.fvaluen)
      // Handle ranges (fvaluer is numrange type)
      if (item.fvaluer) {
        // Parse range string like "[2700,3000]"
        const match = item.fvaluer.match(/\[(\d+),(\d+)\]/)
        if (match) {
          values.push(Number(match[1]))
          values.push(Number(match[2]))
        }
      }
    })

    if (values.length === 0) return null

    return {
      min: Math.min(...values),
      max: Math.max(...values)
    }
  } catch (error) {
    console.error('Error fetching filter range:', error)
    return null
  }
}
