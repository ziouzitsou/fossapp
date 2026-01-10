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

    // Fetch area info for job name
    const { data: areaInfo, error: areaError } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .select(`
        id,
        revision_number,
        project_area:project_areas!inner (
          area_code,
          project:projects!inner (
            id,
            project_code
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
    const projectArea = areaInfo.project_area as unknown as { area_code: string; project: { id: string; project_code: string } }
    const areaCode = projectArea.area_code
    const projectId = projectArea.project.id
    const revisionNumber = areaInfo.revision_number

    // Create job and return ID immediately
    const jobId = generateJobId()
    createJob(jobId, `XREF: ${areaCode} v${revisionNumber}`)

    // Start processing in the background (don't await)
    processInBackground(jobId, {
      areaRevisionId: body.areaRevisionId,
      projectId,
      areaCode,
      revisionNumber,
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
    areaCode: string
    revisionNumber: number
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
        areaCode: params.areaCode,
        revisionNumber: params.revisionNumber,
      },
      (phase, message, detail) => {
        // Cast phase to expected type (service may use custom phases)
        addProgress(jobId, phase as Parameters<typeof addProgress>[1], message, detail)
      }
    )

    if (result.success && result.outputDwgBuffer) {
      // TODO: Upload to Google Drive (02_Areas/{areaCode}/v{n}/Output/)
      // For now, just mark as complete
      // The DWG buffer could be served via a separate download endpoint if needed

      addProgress(jobId, 'complete', 'Generation complete', result.outputFilename)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      completeJob(jobId, true, {
        outputFilename: result.outputFilename,
        missingSymbols: result.missingSymbols,
        // driveLink will be added when Google Drive upload is implemented
      } as any)
    } else {
      addProgress(jobId, 'error', 'Generation failed', result.errors.join(', '))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      completeJob(jobId, false, {
        errors: result.errors,
        missingSymbols: result.missingSymbols,
      } as any)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[case-study/generate] Background error:', error)
    addProgress(jobId, 'error', 'Generation failed', errorMessage)
    completeJob(jobId, false, { errors: [errorMessage] })
  }
}
