/**
 * API Endpoint for Case Study DWG Generation
 * POST /api/case-study/generate
 *
 * Generates a DWG file with luminaire symbols attached as XREFs.
 * Returns jobId immediately, client subscribes to SSE for progress.
 *
 * @remarks
 * Uses the same progress-store pattern as tiles generation.
 * The generated DWG contains XREF references that resolve via
 * Google Drive paths when opened locally.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit, rateLimitHeaders } from '@fossapp/core/ratelimit'
import { createJob, addProgress, completeJob, generateJobId } from '@fossapp/tiles/progress'
import { getXrefGeneratorService } from '@/lib/case-study'
import { supabaseServer } from '@fossapp/core/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max (longer than tiles due to more files)

/**
 * Request body for generation
 */
interface GenerateRequestBody {
  areaRevisionId: string
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting (strict - expensive operation)
    const rateLimit = checkRateLimit(session.user.email, 'case-study-generate')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 3 generations per minute.' },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      )
    }

    const body: GenerateRequestBody = await request.json()

    if (!body.areaRevisionId) {
      return NextResponse.json({ error: 'Missing areaRevisionId' }, { status: 400 })
    }

    // Fetch area info for job name + project data for bucket/drive upload
    const { data: areaInfo, error: areaError } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .select(`
        id,
        revision_number,
        floor_plan_urn,
        google_drive_folder_id,
        project_area:project_areas!inner (
          area_code,
          project:projects!inner (
            id,
            project_code,
            oss_bucket
          )
        )
      `)
      .eq('id', body.areaRevisionId)
      .single()

    if (areaError || !areaInfo) {
      return NextResponse.json(
        { error: `Area revision not found: ${areaError?.message || 'Unknown error'}` },
        { status: 404 }
      )
    }

    // Type assertion for nested data
    // Supabase returns joins as arrays when using !inner, but .single() gives us the first item
    const projectArea = areaInfo.project_area as unknown as {
      area_code: string
      project: { id: string; project_code: string; oss_bucket: string | null }
    }
    const areaCode = projectArea.area_code
    const projectId = projectArea.project.id
    const projectCode = projectArea.project.project_code
    const ossBucket = projectArea.project.oss_bucket
    const revisionNumber = areaInfo.revision_number
    const floorPlanUrn = areaInfo.floor_plan_urn
    const driveFolderId = areaInfo.google_drive_folder_id

    // Validate required fields for generation
    if (!floorPlanUrn) {
      return NextResponse.json(
        { error: 'No floor plan uploaded for this area revision' },
        { status: 400 }
      )
    }

    if (!ossBucket) {
      return NextResponse.json(
        { error: 'Project OSS bucket not configured' },
        { status: 400 }
      )
    }

    // Create job and return ID immediately
    const jobId = generateJobId()
    createJob(jobId, `XREF: ${areaCode} v${revisionNumber}`)

    // Start processing in the background (don't await)
    processInBackground(jobId, {
      areaRevisionId: body.areaRevisionId,
      projectId,
      projectCode,
      areaCode,
      revisionNumber,
      ossBucket,
      floorPlanUrn,
      driveFolderId,
    })

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Generation started',
      areaCode,
      revisionNumber,
    })
  } catch (error) {
    console.error('[case-study/generate] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Background processing function - pushes updates to progress store
 */
async function processInBackground(
  jobId: string,
  params: {
    areaRevisionId: string
    projectId: string
    projectCode: string
    areaCode: string
    revisionNumber: number
    ossBucket: string
    floorPlanUrn: string
    driveFolderId: string | null
  }
) {
  try {
    addProgress(
      jobId,
      'init',
      'Starting XREF generation',
      `Area: ${params.areaCode} v${params.revisionNumber}`
    )

    const service = getXrefGeneratorService()

    const result = await service.generateWithProgress(
      {
        areaRevisionId: params.areaRevisionId,
        projectId: params.projectId,
        projectCode: params.projectCode,
        areaCode: params.areaCode,
        revisionNumber: params.revisionNumber,
        ossBucket: params.ossBucket,
        floorPlanUrn: params.floorPlanUrn,
        driveFolderId: params.driveFolderId,
      },
      (phase, message, detail) => {
        // Cast phase to expected type (service may use custom phases)
        addProgress(jobId, phase as Parameters<typeof addProgress>[1], message, detail)
      }
    )

    if (result.success && result.outputDwgBuffer) {
      addProgress(jobId, 'complete', 'Generation complete', result.outputFilename)

      completeJob(jobId, true, {
        outputFilename: result.outputFilename,
        missingSymbols: result.missingSymbols,
        driveLink: result.driveLink,
      } as Record<string, unknown>)
    } else {
      addProgress(jobId, 'error', 'Generation failed', result.errors.join(', '))
      completeJob(jobId, false, {
        errors: result.errors,
        missingSymbols: result.missingSymbols,
      } as Record<string, unknown>)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[case-study/generate] Background error:', error)
    addProgress(jobId, 'error', 'Generation failed', errorMessage)
    completeJob(jobId, false, { errors: [errorMessage] })
  }
}
