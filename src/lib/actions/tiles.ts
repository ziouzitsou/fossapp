'use server'

import { supabaseServer } from '@fossapp/core/db/server'
import { logEvent } from '@fossapp/core/logging/server'
import { validateSearchQuery } from '@fossapp/core/validation'
import { ProductInfo } from '@fossapp/tiles/types'

// ============================================================================
// TILES PRODUCT SEARCH (Full-Text Search)
// ============================================================================

const TILES_SEARCH_LIMIT = 20

/**
 * Search products using PostgreSQL Full-Text Search
 * Searches across: foss_pid, manufacturer_pid, description, supplier, class
 * Uses search.search_products_fts with prefix matching for partial word searches
 *
 * Used by: /api/tiles/search API endpoint, Global Search modal
 */
export async function searchProductsForTilesAction(
  query: string,
  userId?: string
): Promise<ProductInfo[]> {
  try {
    const sanitizedQuery = validateSearchQuery(query)

    // Call search schema function with prefix matching
    // Converts "enter" to "enter:*" to match "ENTERO", etc.
    const { data, error } = await supabaseServer
      .schema('search')
      .rpc('search_products_fts', {
        search_query: sanitizedQuery,
        result_limit: TILES_SEARCH_LIMIT
      })

    if (error) {
      console.error('FTS product search failed:', {
        message: error.message,
        code: error.code,
        query: sanitizedQuery.substring(0, 50),
        userId: userId?.split('@')[0],
      })

      // Fallback to simple ILIKE search if FTS fails
      return fallbackSearch(sanitizedQuery)
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
    console.error('Tiles search action error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return []
  }
}

/**
 * Fallback search using ILIKE when FTS is unavailable
 */
async function fallbackSearch(query: string): Promise<ProductInfo[]> {
  const { data, error } = await supabaseServer
    .schema('items')
    .from('product_info')
    .select('*')
    .or(`foss_pid.ilike.%${query}%,description_short.ilike.%${query}%,manufacturer_pid.ilike.%${query}%`)
    .limit(TILES_SEARCH_LIMIT)

  if (error) {
    console.error('Fallback search failed:', error.message)
    return []
  }

  return (data || []) as ProductInfo[]
}
