'use server'

import { supabaseServer } from '../supabase-server'
import { logEvent } from '../event-logger'
import { validateSearchQuery } from './validation'
import { ProductInfo } from '@/lib/tiles/types'

// ============================================================================
// TILES PRODUCT SEARCH
// ============================================================================

const TILES_SEARCH_LIMIT = 10

/**
 * Search products for tiles feature - returns full ProductInfo for display
 * Used by: /api/tiles/search API endpoint
 */
export async function searchProductsForTilesAction(
  query: string,
  userId?: string
): Promise<ProductInfo[]> {
  try {
    const sanitizedQuery = validateSearchQuery(query)

    const { data, error } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('*')
      .ilike('foss_pid', `%${sanitizedQuery}%`)
      .limit(TILES_SEARCH_LIMIT)

    if (error) {
      console.error('Tiles product search failed:', {
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
          search_context: 'tiles',
        },
        pathname: '/tiles'
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
