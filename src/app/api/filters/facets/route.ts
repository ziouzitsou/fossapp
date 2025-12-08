import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase-server'
import { checkRateLimit, rateLimitHeaders } from '@/lib/ratelimit'

/**
 * Validates and sanitizes facet request body
 */
function validateFacetRequest(body: unknown) {
  if (!body || typeof body !== 'object') {
    return {}
  }

  const b = body as Record<string, unknown>

  return {
    taxonomyCode: typeof b.taxonomyCode === 'string'
      ? b.taxonomyCode.trim().slice(0, 100)
      : undefined,
    supplier: typeof b.supplier === 'string'
      ? b.supplier.trim().slice(0, 100)
      : undefined,
    indoor: typeof b.indoor === 'boolean' ? b.indoor : undefined,
    outdoor: typeof b.outdoor === 'boolean' ? b.outdoor : undefined,
    submersible: typeof b.submersible === 'boolean' ? b.submersible : undefined,
    trimless: typeof b.trimless === 'boolean' ? b.trimless : undefined,
    cut_shape_round: typeof b.cut_shape_round === 'boolean' ? b.cut_shape_round : undefined,
    cut_shape_rectangular: typeof b.cut_shape_rectangular === 'boolean' ? b.cut_shape_rectangular : undefined,
  }
}

/**
 * POST /api/filters/facets
 *
 * Fetches dynamic filter facets with product counts based on current filter selections.
 * Returns facet data for all technical filters.
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
  // ✅ Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    )
  }

  // ✅ Rate limiting
  const rateLimit = checkRateLimit(session.user.email, 'filters-facets')
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please slow down.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    )
  }

  try {
    const body = await request.json()

    // ✅ Validate and sanitize inputs
    const {
      taxonomyCode,
      supplier,
      indoor,
      outdoor,
      submersible,
      trimless,
      cut_shape_round,
      cut_shape_rectangular
    } = validateFacetRequest(body)

    // Call the get_dynamic_facets RPC function
    const { data, error } = await supabaseServer
      .schema('search')
      .rpc('get_dynamic_facets', {
        p_taxonomy_codes: taxonomyCode ? [taxonomyCode] : null,
        p_suppliers: supplier ? [supplier] : null,
        p_indoor: indoor ?? null,
        p_outdoor: outdoor ?? null,
        p_submersible: submersible ?? null,
        p_trimless: trimless ?? null,
        p_cut_shape_round: cut_shape_round ?? null,
        p_cut_shape_rectangular: cut_shape_rectangular ?? null,
        p_filters: null,
        p_query: null
      })

    if (error) {
      console.error('RPC error in get_dynamic_facets:', error)
      throw error
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching facets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch facets' },
      { status: 500 }
    )
  }
}
