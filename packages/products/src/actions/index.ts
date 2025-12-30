'use server'

import { supabaseServer, logEvent, PAGINATION } from '@fossapp/core'
import {
  validateSearchQuery,
  validateProductId,
  validateTaxonomyCode,
  validateSupplierId,
} from '@fossapp/core/validation'
import type { ProductInfo, ProductSearchResult } from '../types'

// Re-export types for convenience
export type { ProductSearchResult } from '../types'

// ============================================================================
// INTERFACES
// ============================================================================

/** @deprecated Use ProductInfo from @fossapp/products/types instead */
export interface ProductDetail {
  product_id: string
  foss_pid: string
  description_short: string
  description_long: string
  supplier_name: string
  supplier_logo?: string
  supplier_logo_dark?: string
  class_name?: string
  family?: string
  subfamily?: string
  prices: Array<{
    date: string
    disc1: number
    start_price: number
  }>
  multimedia?: Array<{
    mime_code: string
    mime_source: string
  }>
  features?: Array<{
    feature_name: string
    fvalueC_desc?: string
    fvalueN?: number
    unit_abbrev?: string
    fvalueB?: boolean
  }>
}

export interface ProductByTaxonomy {
  product_id: string
  foss_pid: string
  description_short: string
  description_long: string
  supplier_name: string
  supplier_logo?: string
  supplier_logo_dark?: string
  prices: Array<{
    date: string
    disc1: number
    start_price: number
  }>
  multimedia?: Array<{
    mime_code: string
    mime_source: string
  }>
}

export interface ProductByTaxonomyResult {
  products: ProductByTaxonomy[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============================================================================
// BASIC SEARCH
// ============================================================================

/**
 * Basic text search for products (simple query, no filters)
 * Used by: /api/products/search API endpoint
 * For advanced filter search, use searchProductsWithFiltersAction from search-actions.ts
 */
export async function searchProductsBasicAction(query: string, userId?: string): Promise<ProductSearchResult[]> {
  try {
    const sanitizedQuery = validateSearchQuery(query)

    const { data, error } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('product_id, foss_pid, description_short, supplier_name, prices')
      .or(`description_short.ilike.%${sanitizedQuery}%,foss_pid.ilike.%${sanitizedQuery}%,supplier_name.ilike.%${sanitizedQuery}%,family.ilike.%${sanitizedQuery}%,subfamily.ilike.%${sanitizedQuery}%`)
      .order('description_short')
      .limit(PAGINATION.DEFAULT_SEARCH_LIMIT)

    if (error) {
      console.error('Product search failed:', {
        message: error.message,
        code: error.code,
        query: sanitizedQuery.substring(0, 50),
        userId: userId?.split('@')[0],
      })
      return []
    }

    // Log search event if userId is provided
    if (userId) {
      const resultsCount = data?.length || 0

      await logEvent('search', userId, {
        eventData: {
          search_query: sanitizedQuery,
          results_count: resultsCount,
        },
        pathname: '/products'
      })

      if (resultsCount === 0) {
        await logEvent('search_no_results', userId, {
          eventData: {
            search_query: sanitizedQuery,
          },
          pathname: '/products'
        })
      }
    }

    return data || []
  } catch (error) {
    console.error('Search action error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return []
  }
}

// ============================================================================
// GET BY ID
// ============================================================================

export async function getProductByIdAction(productId: string, userId?: string): Promise<ProductInfo | null> {
  try {
    const sanitizedProductId = validateProductId(productId)

    const { data, error } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('*')
      .eq('product_id', sanitizedProductId)
      .single()

    if (error) {
      console.error('Product fetch failed:', {
        message: error.message,
        code: error.code,
        productId: sanitizedProductId.substring(0, 8) + '...',
        userId: userId?.split('@')[0],
      })
      return null
    }

    if (data) {
      if (userId) {
        await logEvent('product_view', userId, {
          eventData: {
            product_id: sanitizedProductId,
            foss_pid: data.foss_pid,
            supplier: data.supplier_name,
            description: data.description_short,
          },
          pathname: `/products/${sanitizedProductId}`
        })
      }

      return data as ProductInfo
    }
  } catch (error) {
    console.error('Get product action error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }

  return null
}

// ============================================================================
// GET BY TAXONOMY
// ============================================================================

/**
 * Get products filtered by taxonomy code and optional supplier (legacy - no pagination)
 */
export async function getProductsByTaxonomyAction(
  taxonomyCode: string,
  supplierId?: number
): Promise<ProductByTaxonomy[]> {
  try {
    const sanitizedTaxonomyCode = validateTaxonomyCode(taxonomyCode)
    const sanitizedSupplierId = supplierId ? validateSupplierId(supplierId) : null

    const query = supabaseServer
      .schema('search')
      .from('product_taxonomy_flags')
      .select('product_id')
      .contains('taxonomy_path', [sanitizedTaxonomyCode])
      .limit(PAGINATION.TAXONOMY_QUERY_LIMIT)

    const { data: productIds, error: taxonomyError } = await query

    if (taxonomyError || !productIds) {
      console.error('Error getting products by taxonomy:', taxonomyError)
      return []
    }

    if (productIds.length === 0) {
      return []
    }

    const ids = productIds.map(p => p.product_id)

    let productQuery = supabaseServer
      .schema('items')
      .from('product_info')
      .select('product_id, foss_pid, description_short, description_long, supplier_name, supplier_logo, supplier_logo_dark, prices, multimedia, catalog_id')
      .in('product_id', ids)

    if (sanitizedSupplierId) {
      const { data: catalogs, error: catalogError } = await supabaseServer
        .schema('items')
        .from('catalog')
        .select('id')
        .eq('supplier_id', sanitizedSupplierId)
        .eq('active', true)

      if (catalogError) {
        console.error('Error getting catalogs for supplier:', catalogError)
        return []
      }

      if (!catalogs || catalogs.length === 0) {
        return []
      }

      const catalogIds = catalogs.map(c => c.id)
      productQuery = productQuery.in('catalog_id', catalogIds)
    }

    const { data: products, error: productsError } = await productQuery
      .order('description_short')
      .limit(PAGINATION.TAXONOMY_QUERY_LIMIT)

    if (productsError) {
      console.error('Error fetching product details:', productsError)
      return []
    }

    return products || []
  } catch (error) {
    console.error('Get products by taxonomy error:', error)
    return []
  }
}

/**
 * Get paginated products filtered by taxonomy code and optional supplier
 */
export async function getProductsByTaxonomyPaginatedAction(
  taxonomyCode: string,
  options: {
    page?: number
    pageSize?: number
    supplierId?: number
  } = {}
): Promise<ProductByTaxonomyResult> {
  try {
    const page = options.page || 1
    const pageSize = options.pageSize || PAGINATION.DEFAULT_PRODUCT_PAGE_SIZE
    const offset = (page - 1) * pageSize

    const sanitizedTaxonomyCode = validateTaxonomyCode(taxonomyCode)
    const sanitizedSupplierId = options.supplierId ? validateSupplierId(options.supplierId) : null

    // Get supplier name for filter if provided
    let supplierName: string | undefined
    if (sanitizedSupplierId) {
      const { data: supplier, error: supplierError } = await supabaseServer
        .schema('items')
        .from('supplier')
        .select('supplier_name')
        .eq('id', sanitizedSupplierId)
        .single()

      if (supplierError || !supplier) {
        return { products: [], total: 0, page, pageSize, totalPages: 0 }
      }

      supplierName = supplier.supplier_name
    }

    let allMatchingIds: string[] = []
    let total = 0

    if (supplierName) {
      // When supplier is filtered, get products matching BOTH taxonomy AND supplier
      const { data: taxonomyMatches, error: taxonomyError } = await supabaseServer
        .schema('search')
        .from('product_taxonomy_flags')
        .select('product_id')
        .contains('taxonomy_path', [sanitizedTaxonomyCode])

      if (taxonomyError || !taxonomyMatches) {
        console.error('Error getting products by taxonomy:', taxonomyError)
        return { products: [], total: 0, page, pageSize, totalPages: 0 }
      }

      if (taxonomyMatches.length === 0) {
        return { products: [], total: 0, page, pageSize, totalPages: 0 }
      }

      const taxonomyIds = taxonomyMatches.map(p => p.product_id)

      const { data: filteredProducts, error: filterError } = await supabaseServer
        .rpc('get_products_by_taxonomy_and_supplier', {
          p_taxonomy_ids: taxonomyIds,
          p_supplier_name: supplierName
        })

      if (filterError) {
        console.error('Error filtering products by supplier:', filterError)
        return { products: [], total: 0, page, pageSize, totalPages: 0 }
      }

      allMatchingIds = (filteredProducts || []).map((p: { product_id: string }) => p.product_id)
      total = allMatchingIds.length
    } else {
      // No supplier filter - just count and get IDs from taxonomy
      const { count: totalCount, error: countError } = await supabaseServer
        .schema('search')
        .from('product_taxonomy_flags')
        .select('product_id', { count: 'exact', head: true })
        .contains('taxonomy_path', [sanitizedTaxonomyCode])

      if (countError) {
        console.error('Error counting products by taxonomy:', countError)
        return { products: [], total: 0, page, pageSize, totalPages: 0 }
      }

      total = totalCount || 0

      if (total === 0) {
        return { products: [], total: 0, page, pageSize, totalPages: 0 }
      }

      const { data: productIds, error: taxonomyError } = await supabaseServer
        .schema('search')
        .from('product_taxonomy_flags')
        .select('product_id')
        .contains('taxonomy_path', [sanitizedTaxonomyCode])
        .range(offset, offset + pageSize - 1)

      if (taxonomyError || !productIds) {
        console.error('Error getting products by taxonomy:', taxonomyError)
        return { products: [], total: 0, page, pageSize, totalPages: 0 }
      }

      allMatchingIds = productIds.map(p => p.product_id)
    }

    if (allMatchingIds.length === 0) {
      return {
        products: [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }

    // For supplier filtering, paginate the IDs
    const paginatedIds = supplierName
      ? allMatchingIds.slice(offset, offset + pageSize)
      : allMatchingIds

    if (paginatedIds.length === 0) {
      return {
        products: [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }

    // Get full product details for the paginated IDs
    const { data: products, error: productsError } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('product_id, foss_pid, description_short, description_long, supplier_name, supplier_logo, supplier_logo_dark, prices, multimedia, catalog_id')
      .in('product_id', paginatedIds)
      .order('description_short')

    if (productsError) {
      console.error('Error fetching product details:', productsError)
      return {
        products: [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }

    return {
      products: products || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  } catch (error) {
    console.error('Get products by taxonomy paginated error:', error)
    return {
      products: [],
      total: 0,
      page: options.page || 1,
      pageSize: options.pageSize || PAGINATION.DEFAULT_PRODUCT_PAGE_SIZE,
      totalPages: 0
    }
  }
}

// ============================================================================
// FULL-TEXT SEARCH (FTS)
// ============================================================================

const FTS_SEARCH_LIMIT = 20

/**
 * Search products using PostgreSQL Full-Text Search with prefix matching.
 * Searches across: foss_pid, manufacturer_pid, description, supplier, class
 * Converts multi-word queries like "entero lum" to "entero:* & lum:*" for partial matching.
 *
 * Used by: /api/products/search API endpoint, Global Search modal
 */
export async function searchProductsFTSAction(
  query: string,
  userId?: string
): Promise<ProductInfo[]> {
  try {
    const sanitizedQuery = validateSearchQuery(query)

    // Call search schema function with prefix matching
    const { data, error } = await supabaseServer
      .schema('search')
      .rpc('search_products_fts', {
        search_query: sanitizedQuery,
        result_limit: FTS_SEARCH_LIMIT
      })

    if (error) {
      console.error('FTS product search failed:', {
        message: error.message,
        code: error.code,
        query: sanitizedQuery.substring(0, 50),
        userId: userId?.split('@')[0],
      })

      // Fallback to simple ILIKE search if FTS fails
      return fallbackILIKESearch(sanitizedQuery)
    }

    // Log search event if userId is provided
    if (userId) {
      const resultsCount = data?.length || 0

      await logEvent('search', userId, {
        eventData: {
          search_query: sanitizedQuery,
          results_count: resultsCount,
          search_context: 'global-search',
          search_type: 'fts',
        },
        pathname: '/search'
      })
    }

    return (data || []) as ProductInfo[]
  } catch (error) {
    console.error('FTS search action error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return []
  }
}

/**
 * Fallback search using ILIKE when FTS is unavailable
 */
async function fallbackILIKESearch(query: string): Promise<ProductInfo[]> {
  const { data, error } = await supabaseServer
    .schema('items')
    .from('product_info')
    .select('*')
    .or(`foss_pid.ilike.%${query}%,description_short.ilike.%${query}%,manufacturer_pid.ilike.%${query}%`)
    .limit(FTS_SEARCH_LIMIT)

  if (error) {
    console.error('Fallback ILIKE search failed:', error.message)
    return []
  }

  return (data || []) as ProductInfo[]
}
