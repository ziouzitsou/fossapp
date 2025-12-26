'use server'

import { supabaseServer } from '@fossapp/core/db/server'

// ============================================================================
// INTERFACES
// ============================================================================

export interface Supplier {
  id: number
  supplier_name: string
  code: string
  logo?: string
  logo_dark?: string
  country?: string
  product_count: number
}

// ============================================================================
// GET ACTIVE SUPPLIERS
// ============================================================================

/**
 * Fetch active suppliers with product counts
 */
export async function getActiveSuppliersAction(): Promise<Supplier[]> {
  try {
    // Get all suppliers
    const { data: suppliers, error: supplierError } = await supabaseServer
      .schema('items')
      .from('supplier')
      .select('id, supplier_name, code, logo, logo_dark, country')

    if (supplierError || !suppliers) {
      console.error('Error getting active suppliers:', supplierError)
      return []
    }

    // Get product counts using RPC (aggregated in DB, no row limit issues)
    const { data: supplierCounts, error: countError } = await supabaseServer
      .schema('search')
      .rpc('get_global_supplier_counts')

    if (countError) {
      console.error('Error counting products:', countError)
      return []
    }

    // Create map of supplier counts
    const supplierCountMap = new Map<string, number>()
    if (supplierCounts && Array.isArray(supplierCounts)) {
      supplierCounts.forEach((row: { supplier_name: string; product_count: number }) => {
        supplierCountMap.set(row.supplier_name, Number(row.product_count))
      })
    }

    // Map suppliers with their product counts
    const suppliersWithCounts: Supplier[] = suppliers.map((supplier: {
      id: number
      supplier_name: string
      code: string
      logo: string | null
      logo_dark: string | null
      country: string | null
    }) => ({
      id: supplier.id,
      supplier_name: supplier.supplier_name,
      code: supplier.code,
      logo: supplier.logo || undefined,
      logo_dark: supplier.logo_dark || undefined,
      country: supplier.country || undefined,
      product_count: supplierCountMap.get(supplier.supplier_name) || 0
    }))

    // Sort by product count descending, filter out suppliers with 0 products
    return suppliersWithCounts
      .filter(s => s.product_count > 0)
      .sort((a, b) => b.product_count - a.product_count)
  } catch (error) {
    console.error('Get active suppliers error:', error)
    return []
  }
}

// ============================================================================
// GET SUPPLIERS WITH TAXONOMY COUNTS
// ============================================================================

/**
 * Fetch suppliers with product counts filtered by taxonomy (context-aware)
 */
export async function getSuppliersWithTaxonomyCountsAction(
  taxonomyCode?: string
): Promise<Supplier[]> {
  try {
    // Get all suppliers
    const { data: suppliers, error: supplierError } = await supabaseServer
      .schema('items')
      .from('supplier')
      .select('id, supplier_name, code, logo, logo_dark, country')

    if (supplierError || !suppliers) {
      console.error('Error getting suppliers:', supplierError)
      return []
    }

    // If no taxonomy filter, get global counts
    if (!taxonomyCode) {
      return getActiveSuppliersAction()
    }

    // Get product counts filtered by taxonomy using RPC function
    const { data: supplierCounts, error: countError } = await supabaseServer
      .schema('search')
      .rpc('get_supplier_counts_by_taxonomy', {
        p_taxonomy_code: taxonomyCode
      })

    if (countError) {
      console.error('Error counting products by taxonomy:', countError)
      return []
    }

    // Create map of supplier counts
    const supplierCountMap = new Map<string, number>()
    if (supplierCounts && Array.isArray(supplierCounts)) {
      supplierCounts.forEach((row: { supplier_name: string; product_count: number }) => {
        supplierCountMap.set(row.supplier_name, row.product_count)
      })
    }

    // Map suppliers with their filtered counts
    const suppliersWithCounts: Supplier[] = suppliers.map((supplier: {
      id: number
      supplier_name: string
      code: string
      logo: string | null
      logo_dark: string | null
      country: string | null
    }) => ({
      id: supplier.id,
      supplier_name: supplier.supplier_name,
      code: supplier.code,
      logo: supplier.logo || undefined,
      logo_dark: supplier.logo_dark || undefined,
      country: supplier.country || undefined,
      product_count: supplierCountMap.get(supplier.supplier_name) || 0
    }))

    // Sort by product count descending, filter out suppliers with 0 products
    return suppliersWithCounts
      .filter(s => s.product_count > 0)
      .sort((a, b) => b.product_count - a.product_count)
  } catch (error) {
    console.error('Get suppliers with taxonomy counts error:', error)
    return []
  }
}
