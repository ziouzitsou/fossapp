'use server'

import { supabaseServer } from '../supabase-server'
import { TaxonomyCategory } from '../taxonomy-data'

// Re-export type for convenience
export type { TaxonomyCategory } from '../taxonomy-data'

// ============================================================================
// TAXONOMY WITH COUNTS
// ============================================================================

/**
 * Fetch taxonomy hierarchy with dynamic product counts from database
 * Replaces hardcoded taxonomy data with live database queries
 */
export async function getTaxonomyWithCountsAction(): Promise<TaxonomyCategory[]> {
  try {
    // Fetch all taxonomy entries from database
    const { data: taxonomyData, error: taxonomyError } = await supabaseServer
      .schema('search')
      .from('taxonomy')
      .select('code, name, description, level, icon, parent_code, display_order')
      .eq('active', true)
      .order('display_order')
      .order('name')

    if (taxonomyError || !taxonomyData) {
      console.error('Error fetching taxonomy:', taxonomyError)
      return []
    }

    // Get product counts for each taxonomy code using taxonomy_path
    // This query counts products where the taxonomy code appears anywhere in the taxonomy_path array
    const countPromises = taxonomyData.map(async (tax) => {
      const { count, error } = await supabaseServer
        .schema('search')
        .from('product_taxonomy_flags')
        .select('product_id', { count: 'exact', head: true })
        .contains('taxonomy_path', [tax.code])

      if (error) {
        console.error(`Error counting products for ${tax.code}:`, error)
        return { code: tax.code, count: 0 }
      }

      return { code: tax.code, count: count || 0 }
    })

    const counts = await Promise.all(countPromises)
    const countMap = new Map(counts.map(c => [c.code, c.count]))

    // Build hierarchical structure
    const taxonomyMap = new Map<string, TaxonomyCategory>()

    // First pass: create all nodes
    taxonomyData.forEach(tax => {
      taxonomyMap.set(tax.code, {
        code: tax.code,
        name: tax.name,
        description: tax.description || '',
        level: tax.level,
        icon: tax.icon || 'Package',
        productCount: countMap.get(tax.code) || 0,
        children: []
      })
    })

    // Second pass: build parent-child relationships
    const rootCategories: TaxonomyCategory[] = []

    taxonomyData.forEach(tax => {
      const category = taxonomyMap.get(tax.code)
      if (!category) return

      // Level 1 categories are the root (even if they have parent_code='ROOT')
      if (tax.level === 1) {
        rootCategories.push(category)
      } else if (tax.parent_code && tax.parent_code !== 'ROOT') {
        // For level 2+, attach to parent
        const parent = taxonomyMap.get(tax.parent_code)
        if (parent) {
          if (!parent.children) parent.children = []
          parent.children.push(category)
        }
      }
    })

    return rootCategories
  } catch (error) {
    console.error('Error in getTaxonomyWithCountsAction:', error)
    return []
  }
}
