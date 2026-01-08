import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  generateObjectKey,
  generateBucketName,
  translateToSVF2,
  calculateFileHash
} from '@/lib/planner/aps-planner-service'
import { supabaseServer } from '@fossapp/core/db/server'
import { checkRateLimit, rateLimitHeaders } from '@fossapp/core/ratelimit'
import { PlannerDesignAutomationService } from '@/lib/planner/design-automation-service'

/**
 * Sanitize filename to prevent path traversal and other attacks
 *
 * Security measures:
 * 1. Decode URL-encoded characters first (catches %2F, %2E, etc.)
 * 2. Remove path traversal sequences (.., /, \)
 * 3. Remove dangerous characters
 * 4. Whitelist only safe characters (alphanumeric, spaces, dots, hyphens, underscores)
 * 5. Ensure filename doesn't start with dots
 * 6. Limit length to prevent filesystem issues
 *
 * @param filename - Raw filename from user upload
 * @returns Sanitized filename safe for filesystem use
 */
function sanitizeFileName(filename: string): string {
  // Step 1: Decode URL-encoded characters (e.g., %2F -> /, %2E -> .)
  // This catches attacks like "..%2F..%2Fetc%2Fpasswd"
  let decoded = filename
  try {
    // Decode multiple times to catch double-encoding attacks
    let prev = ''
    while (prev !== decoded) {
      prev = decoded
      decoded = decodeURIComponent(decoded)
    }
  } catch {
    // If decoding fails, use original (malformed encoding)
    decoded = filename
  }

  // Step 2: Extract just the basename (remove any path components)
  // This handles both Unix (/) and Windows (\) path separators
  const basename = decoded.split(/[/\\]/).pop() || decoded

  // Step 3: Remove path traversal sequences
  let sanitized = basename
    .replace(/\.\./g, '')      // Remove .. sequences
    .replace(/\.\//g, '')      // Remove ./ sequences
    .replace(/\.\\/g, '')      // Remove .\ sequences

  // Step 4: Remove dangerous filesystem characters
  // Keep only: alphanumeric, dots, hyphens, underscores, parentheses, spaces (converted later)
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s.\-_()]/g, '_')

  // Step 5: Replace spaces with underscores (OSS signed URLs have issues with spaces)
  sanitized = sanitized.replace(/\s+/g, '_').replace(/_+/g, '_')

  // Step 6: Remove leading dots (hidden files / extension confusion)
  sanitized = sanitized.replace(/^\.+/, '')

  // Step 7: Ensure we have a valid filename
  if (!sanitized || sanitized === '_') {
    sanitized = 'upload'
  }

  // Step 8: Limit length (keep extension intact if possible)
  const maxLength = 200
  if (sanitized.length > maxLength) {
    const extMatch = sanitized.match(/\.[a-zA-Z0-9]+$/)
    const ext = extMatch ? extMatch[0] : ''
    const nameLength = maxLength - ext.length
    sanitized = sanitized.substring(0, nameLength) + ext
  }

  return sanitized
}

/**
 * Check if floor plan with this hash already exists in any area revision
 * Returns existing URN if found (cache hit)
 */
async function checkFloorPlanCache(hash: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .schema('projects')
    .from('project_area_revisions')
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
 * Upload floor plan DWG for an area revision with persistent storage and caching.
 *
 * Body: FormData with:
 *   - 'file': DWG file
 *   - 'projectId': Project UUID (for bucket reference)
 *   - 'areaRevisionId': Area revision UUID
 *
 * Returns: { urn: string, isNewUpload: boolean, bucketName: string, fileName: string }
 *
 * Features:
 *   - SHA256 hash caching (same file = instant URN return)
 *   - Persistent OSS bucket per project
 *   - Structured object keys: {areaId}/{revisionId}/{filename}
 *   - Database storage of URN in project_area_revisions table
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
    const areaRevisionId = formData.get('areaRevisionId') as string | null

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

    if (!areaRevisionId) {
      return NextResponse.json(
        { error: 'No areaRevisionId provided' },
        { status: 400 }
      )
    }

    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID format' },
        { status: 400 }
      )
    }
    if (!uuidRegex.test(areaRevisionId)) {
      return NextResponse.json(
        { error: 'Invalid area revision ID format' },
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

    // Verify area revision exists and get area info + project's oss_bucket
    const { data: areaRevision, error: arError } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .select(`
        id,
        area_id,
        revision_number,
        project_areas!inner(
          id,
          project_id,
          area_code,
          projects!inner(
            id,
            oss_bucket
          )
        )
      `)
      .eq('id', areaRevisionId)
      .single()

    if (arError || !areaRevision) {
      return NextResponse.json(
        { error: 'Area revision not found' },
        { status: 404 }
      )
    }

    // Type assertion for nested data (Supabase returns object for !inner join with single())
    const projectAreas = areaRevision.project_areas as unknown as {
      id: string
      project_id: string
      area_code: string
      projects: { id: string; oss_bucket: string | null }
    }

    // Verify the area revision belongs to the specified project
    if (projectAreas.project_id !== projectId) {
      return NextResponse.json(
        { error: 'Area revision does not belong to the specified project' },
        { status: 400 }
      )
    }

    const bucketName = projectAreas.projects.oss_bucket
    if (!bucketName) {
      return NextResponse.json(
        { error: 'Project does not have an OSS bucket configured' },
        { status: 400 }
      )
    }

    // Sanitize filename (prevents path traversal, URL-encoded attacks, etc.)
    const sanitizedFileName = sanitizeFileName(file.name)

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log(`[Planner API] Processing ${sanitizedFileName} (${(buffer.length / 1024 / 1024).toFixed(2)} MB) for area revision ${areaRevisionId}`)

    // Calculate file hash for caching
    const fileHash = calculateFileHash(buffer)
    console.log(`[Planner API] File hash: ${fileHash.substring(0, 16)}...`)

    // Check cache - if same file exists anywhere, reuse its URN
    const cachedUrn = await checkFloorPlanCache(fileHash)
    if (cachedUrn) {
      console.log(`[Planner API] Cache hit! Using existing URN`)

      // Save to area revision (reusing existing URN)
      const { error: updateError } = await supabaseServer
        .schema('projects')
        .from('project_area_revisions')
        .update({
          floor_plan_urn: cachedUrn,
          floor_plan_filename: sanitizedFileName,
          floor_plan_hash: fileHash
        })
        .eq('id', areaRevisionId)

      if (updateError) {
        console.error('[Planner API] Database update error:', updateError)
        return NextResponse.json(
          { error: 'Failed to save floor plan info' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        urn: cachedUrn,
        isNewUpload: false,
        bucketName,
        fileName: sanitizedFileName
      })
    }

    // No cache hit - process through FOSS.dwt template via Design Automation
    // OPTIMIZED: Template already in bucket, output goes directly to final location
    const uploadStartTime = Date.now()
    console.log('\n' + '▓'.repeat(60))
    console.log('[Planner API] FLOOR PLAN UPLOAD - NEW FILE (Optimized)')
    console.log(`[Planner API] File: ${sanitizedFileName}`)
    console.log(`[Planner API] Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)
    console.log(`[Planner API] Area: ${projectAreas.area_code} v${areaRevision.revision_number}`)
    console.log(`[Planner API] Bucket: ${bucketName}`)
    console.log('▓'.repeat(60))

    // Generate output object key
    const objectKey = generateObjectKey(
      projectAreas.area_code,
      areaRevision.revision_number,
      sanitizedFileName
    )

    // Step 1: Process through Design Automation
    // Template is already in bucket, output goes directly to final location
    console.log('[Planner API] [1/2] Starting Design Automation processing...')
    const daService = new PlannerDesignAutomationService()
    const daResult = await daService.processFloorPlan(
      bucketName,
      buffer,
      objectKey
    )

    if (!daResult.success || !daResult.urn) {
      console.error('[Planner API] [1/2] ✗ DA processing failed:', daResult.errors)
      return NextResponse.json(
        { error: `Design Automation failed: ${daResult.errors.join(', ')}` },
        { status: 500 }
      )
    }

    console.log(`[Planner API] [1/2] DA complete → ${objectKey}`)

    // Step 2: Start translation (DWG already in bucket from DA)
    console.log('[Planner API] [2/2] Starting SVF2 translation...')
    const urn = daResult.urn
    await translateToSVF2(urn)
    console.log('[Planner API] [2/2] Translation started')

    const totalUploadTime = ((Date.now() - uploadStartTime) / 1000).toFixed(1)
    console.log('▓'.repeat(60))
    console.log(`[Planner API] ✓ UPLOAD COMPLETE in ${totalUploadTime}s`)
    console.log(`[Planner API] URN: ${urn.substring(0, 30)}...`)
    console.log('▓'.repeat(60) + '\n')

    // Save to area revision with status 'inprogress' (translation started)
    const { error: updateError } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .update({
        floor_plan_urn: urn,
        floor_plan_filename: sanitizedFileName,
        floor_plan_hash: fileHash,
        floor_plan_status: 'inprogress'
      })
      .eq('id', areaRevisionId)

    if (updateError) {
      console.error('[Planner API] Database update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to save floor plan info' },
        { status: 500 }
      )
    }

    console.log(`[Planner API] Floor plan saved for area revision ${areaRevisionId}`)

    return NextResponse.json({
      urn,
      isNewUpload: true,
      bucketName,
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
 * GET /api/planner/upload?areaRevisionId={uuid}
 *
 * Get existing floor plan info for an area revision
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

  try {
    const { data, error } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .select(`
        floor_plan_urn,
        floor_plan_filename,
        floor_plan_hash,
        area_id,
        project_areas!inner(
          project_id,
          projects!inner(
            oss_bucket
          )
        )
      `)
      .eq('id', areaRevisionId)
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Area revision not found' },
        { status: 404 }
      )
    }

    // Type assertion for nested data (Supabase returns object for !inner join with single())
    const projectAreas = data.project_areas as unknown as {
      project_id: string
      projects: { oss_bucket: string | null }
    }

    if (!data.floor_plan_urn) {
      return NextResponse.json({
        hasFloorPlan: false,
        bucketName: projectAreas.projects.oss_bucket || generateBucketName(projectAreas.project_id)
      })
    }

    return NextResponse.json({
      hasFloorPlan: true,
      urn: data.floor_plan_urn,
      fileName: data.floor_plan_filename,
      bucketName: projectAreas.projects.oss_bucket || generateBucketName(projectAreas.project_id)
    })
  } catch (error) {
    console.error('[Planner API] Get floor plan error:', error)
    return NextResponse.json(
      { error: 'Failed to get floor plan info' },
      { status: 500 }
    )
  }
}
