import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prepareFloorPlan, generateBucketName } from '@/lib/planner/aps-planner-service'
import { supabaseServer } from '@/lib/supabase-server'
import { checkRateLimit, rateLimitHeaders } from '@/lib/ratelimit'

/**
 * Check if floor plan with this hash already exists
 */
async function checkFloorPlanCache(hash: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .schema('projects')
    .from('projects')
    .select('floor_plan_urn')
    .eq('floor_plan_hash', hash)
    .not('floor_plan_urn', 'is', null)
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data.floor_plan_urn
}

/**
 * POST /api/planner/upload
 *
 * Upload floor plan DWG for a project with persistent storage and caching.
 *
 * Body: FormData with:
 *   - 'file': DWG file
 *   - 'projectId': Project UUID
 *
 * Returns: { urn: string, isNewUpload: boolean, bucketName: string }
 *
 * Features:
 *   - SHA256 hash caching (same file = instant URN return)
 *   - Persistent OSS bucket per project
 *   - Database storage of URN for future sessions
 */
export async function POST(request: NextRequest) {
  // Security: Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Rate limiting
  const rateLimit = checkRateLimit(session.user.email, 'planner-upload')
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 20 uploads per minute.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string | null

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'No projectId provided' },
        { status: 400 }
      )
    }

    // Validate project ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID format' },
        { status: 400 }
      )
    }

    // Validate file type
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.dwg')) {
      return NextResponse.json(
        { error: 'Only DWG files are supported' },
        { status: 400 }
      )
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Sanitize filename
    const sanitizedFileName = file.name
      .replace(/\.\./g, '')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/^\.+/, '')

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log(`[Planner API] Processing ${sanitizedFileName} (${(buffer.length / 1024 / 1024).toFixed(2)} MB) for project ${projectId}`)

    // Prepare floor plan with caching
    const result = await prepareFloorPlan(
      projectId,
      sanitizedFileName,
      buffer,
      checkFloorPlanCache
    )

    // Save to database
    const { error: updateError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .update({
        floor_plan_urn: result.urn,
        floor_plan_filename: sanitizedFileName,
        floor_plan_hash: result.fileHash,
        oss_bucket: result.bucketName,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)

    if (updateError) {
      console.error('[Planner API] Database update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to save floor plan info' },
        { status: 500 }
      )
    }

    console.log(`[Planner API] Floor plan saved. Cache hit: ${!result.isNewUpload}`)

    return NextResponse.json({
      urn: result.urn,
      isNewUpload: result.isNewUpload,
      bucketName: result.bucketName,
      fileName: sanitizedFileName
    })
  } catch (error) {
    console.error('[Planner API] Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/planner/upload?projectId={uuid}
 *
 * Get existing floor plan info for a project
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
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json(
      { error: 'No projectId provided' },
      { status: 400 }
    )
  }

  try {
    const { data, error } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select('floor_plan_urn, floor_plan_filename, floor_plan_hash, oss_bucket')
      .eq('id', projectId)
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (!data.floor_plan_urn) {
      return NextResponse.json({
        hasFloorPlan: false
      })
    }

    return NextResponse.json({
      hasFloorPlan: true,
      urn: data.floor_plan_urn,
      fileName: data.floor_plan_filename,
      bucketName: data.oss_bucket || generateBucketName(projectId)
    })
  } catch (error) {
    console.error('[Planner API] Get floor plan error:', error)
    return NextResponse.json(
      { error: 'Failed to get floor plan info' },
      { status: 500 }
    )
  }
}
