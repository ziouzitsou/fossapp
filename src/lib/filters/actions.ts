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
 * Fetch all active filter definitions grouped by category
 */
export async function getFilterDefinitionsAction(
  taxonomyCode?: string
): Promise<FilterGroup[]> {
  try {
    let query = supabaseServer
      .schema('search')
      .from('filter_definitions')
      .select('*')
      .eq('active', true)

    // Filter by applicable taxonomy codes
    if (taxonomyCode) {
      query = query.or(`applicable_taxonomy_codes.cs.{${taxonomyCode}},applicable_taxonomy_codes.is.null`)
    }

    const { data, error } = await query.order('display_order')

    if (error) {
      console.error('Failed to fetch filter definitions:', error)
      return []
    }

    // Group by filter group
    const groups = new Map<string, FilterDefinition[]>()

    data?.forEach((filter) => {
      const group = filter.group || 'Other'
      if (!groups.has(group)) {
        groups.set(group, [])
      }
      groups.get(group)!.push(filter as FilterDefinition)
    })

    // Convert to array format
    const result: FilterGroup[] = []
    const groupOrder = ['Source', 'Electricals', 'Light', 'Design', 'Location', 'Options']

    groupOrder.forEach((groupName) => {
      if (groups.has(groupName)) {
        result.push({
          name: groupName,
          filters: groups.get(groupName)!
        })
      }
    })

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
