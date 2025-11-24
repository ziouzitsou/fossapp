import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * POST /api/filters/facets
 *
 * Fetches dynamic filter facets with product counts based on current filter selections.
 * Returns facet data for all technical filters.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      taxonomyCode,
      supplier,
      indoor,
      outdoor,
      submersible,
      trimless,
      cut_shape_round,
      cut_shape_rectangular
    } = body

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
