import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getManifestData } from '@/lib/planner'
import { supabaseServer } from '@fossapp/core/db/server'

/**
 * GET /api/planner/manifest?areaRevisionId={uuid}
 *
 * Get manifest data for an area revision's floor plan.
 * If translation is complete, stores manifest data in DB.
 *
 * Returns: ManifestData with status, thumbnail, warnings, views
 */
export async function GET(request: NextRequest) {
  // Security: Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const areaRevisionId = searchParams.get('areaRevisionId')

  if (!areaRevisionId) {
    return NextResponse.json(
      { error: 'No areaRevisionId provided' },
      { status: 400 }
    )
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(areaRevisionId)) {
    return NextResponse.json(
      { error: 'Invalid area revision ID format' },
      { status: 400 }
    )
  }

  try {
    // Get the area revision's floor plan URN
    const { data: areaRevision, error: fetchError } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .select('floor_plan_urn, floor_plan_status, floor_plan_manifest')
      .eq('id', areaRevisionId)
      .single()

    if (fetchError || !areaRevision) {
      return NextResponse.json(
        { error: 'Area revision not found' },
        { status: 404 }
      )
    }

    if (!areaRevision.floor_plan_urn) {
      return NextResponse.json(
        { error: 'No floor plan for this area revision' },
        { status: 404 }
      )
    }

    // If we already have a completed manifest in DB, return it
    if (areaRevision.floor_plan_status === 'success' && areaRevision.floor_plan_manifest) {
      return NextResponse.json({
        cached: true,
        ...areaRevision.floor_plan_manifest
      })
    }

    // Fetch fresh manifest from APS
    const manifestData = await getManifestData(areaRevision.floor_plan_urn)

    // If translation is complete, store in DB
    if (manifestData.status === 'success' || manifestData.status === 'failed') {
      const { error: updateError } = await supabaseServer
        .schema('projects')
        .from('project_area_revisions')
        .update({
          floor_plan_status: manifestData.status,
          floor_plan_thumbnail_urn: manifestData.thumbnailUrn || null,
          floor_plan_warnings: manifestData.warningCount,
          floor_plan_manifest: manifestData
        })
        .eq('id', areaRevisionId)

      if (updateError) {
        console.error('[Planner API] Failed to save manifest:', updateError)
      } else {
        console.log(`[Planner API] Manifest saved for area revision ${areaRevisionId}`)
      }
    }

    return NextResponse.json({
      cached: false,
      ...manifestData
    })
  } catch (error) {
    console.error('[Planner API] Manifest error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get manifest' },
      { status: 500 }
    )
  }
}
