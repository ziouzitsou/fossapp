import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAccessToken } from '@/lib/planner/aps-planner-service'
import { supabaseServer } from '@fossapp/core/db/server'

/**
 * GET /api/planner/thumbnail?areaRevisionId={uuid}
 *
 * Proxy endpoint to fetch thumbnail from APS.
 * Returns the PNG image directly.
 *
 * Uses the stored thumbnail URN from the manifest,
 * or fetches from the main URN if not available.
 */
export async function GET(request: NextRequest) {
  // Security: Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const areaRevisionId = searchParams.get('areaRevisionId')

  if (!areaRevisionId) {
    return new NextResponse('No areaRevisionId provided', { status: 400 })
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(areaRevisionId)) {
    return new NextResponse('Invalid area revision ID format', { status: 400 })
  }

  try {
    // Get the area revision's floor plan URN and thumbnail URN
    const { data: areaRevision, error: fetchError } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .select('floor_plan_urn, floor_plan_thumbnail_urn')
      .eq('id', areaRevisionId)
      .single()

    if (fetchError || !areaRevision) {
      return new NextResponse('Area revision not found', { status: 404 })
    }

    if (!areaRevision.floor_plan_urn) {
      return new NextResponse('No floor plan for this area revision', { status: 404 })
    }

    const accessToken = await getAccessToken()

    // Use specific thumbnail URN if available, otherwise use main URN
    const urn = areaRevision.floor_plan_urn

    // Fetch thumbnail from APS
    const response = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/regions/eu/designdata/${encodeURIComponent(urn)}/thumbnail?width=200&height=200`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      console.error(`[Planner API] Thumbnail fetch failed: ${response.status}`)
      return new NextResponse('Thumbnail not available', { status: 404 })
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer()

    // Return as PNG with caching headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('[Planner API] Thumbnail error:', error)
    return new NextResponse('Failed to get thumbnail', { status: 500 })
  }
}
