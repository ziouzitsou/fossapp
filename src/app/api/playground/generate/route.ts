/**
 * API Endpoint for Playground DWG generation from natural language
 * POST /api/playground/generate
 *
 * Flow:
 * 1. LLM generates AutoLISP script from description
 * 2. APS Design Automation executes script
 * 3. Return DWG file
 *
 * Uses smart retry with model escalation (Sonnet → Opus)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit, rateLimitHeaders } from '@fossapp/core/ratelimit'
import { createJob, addProgress, completeJob, generateJobId } from '@/lib/tiles/progress-store'
import { generateScript, retryWithError, extractErrorContext, LLMMessage } from '@/lib/playground/llm-service'
import { apsService } from '@/lib/tiles/aps-service'
import { usdToEur } from '@/lib/currency'

export const dynamic = 'force-dynamic'
export const maxDuration = 180 // 3 minutes max (LLM + APS)

interface PlaygroundPayload {
  description: string
  outputFilename?: string
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = checkRateLimit(session.user.email, 'playground-generate')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 10 playground generations per minute.' },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      )
    }

    const payload: PlaygroundPayload = await request.json()

    if (!payload.description || payload.description.trim().length === 0) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    // Create job and return ID immediately
    const jobId = generateJobId()
    const outputFilename = payload.outputFilename || 'Playground.dwg'
    createJob(jobId, `Playground: ${payload.description.slice(0, 50)}...`)

    // Start processing in the background (don't await)
    processInBackground(jobId, payload.description, outputFilename)

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Playground generation started',
    })
  } catch (error) {
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
 * Background processing with LLM → APS retry loop
 */
async function processInBackground(
  jobId: string,
  description: string,
  outputFilename: string
) {
  const MAX_TOTAL_ATTEMPTS = 3
  let totalAttempts = 0
  let totalCost = 0
  let lastScript: string | undefined
  let lastApsError: string | undefined
  let conversationMessages: LLMMessage[] | undefined

  try {
    addProgress(jobId, 'llm', 'Starting DWG generation', description.slice(0, 100))

    // === ATTEMPT LOOP ===
    while (totalAttempts < MAX_TOTAL_ATTEMPTS) {
      totalAttempts++

      // --- Phase 1: LLM Generation ---
      const modelName = totalAttempts === 1 ? 'Sonnet' : 'Opus'
      addProgress(
        jobId,
        'llm',
        totalAttempts === 1
          ? 'Generating AutoLISP script...'
          : 'Retrying with smarter model...',
        `Attempt ${totalAttempts}/${MAX_TOTAL_ATTEMPTS} using ${modelName}`,
        `Attempt ${totalAttempts}`
      )

      let llmResult

      if (totalAttempts === 1 || !lastScript || !lastApsError) {
        // First attempt or no previous context - fresh generation
        llmResult = await generateScript(
          description,
          outputFilename,
          1, // Single attempt per call (we handle retries here)
          (attempt, model, status) => {
            addProgress(jobId, 'llm', status, `Model: ${model}`, `Attempt ${totalAttempts}`)
          }
        )
      } else {
        // Retry with error context from previous APS failure
        llmResult = await retryWithError(
          description,
          lastScript,
          lastApsError,
          outputFilename,
          conversationMessages,
          (attempt, model, status) => {
            addProgress(jobId, 'llm', status, `Model: ${model}`, `Attempt ${totalAttempts}`)
          }
        )
      }

      totalCost += llmResult.totalCost

      if (!llmResult.success || !llmResult.script) {
        addProgress(
          jobId,
          'error',
          'Script generation failed',
          llmResult.error || 'Unknown LLM error',
          `Attempt ${totalAttempts}`
        )

        if (totalAttempts >= MAX_TOTAL_ATTEMPTS) {
          completeJob(jobId, false, {
            errors: [`LLM failed after ${totalAttempts} attempts: ${llmResult.error}`],
          })
          return
        }
        continue
      }

      lastScript = llmResult.script
      addProgress(
        jobId,
        'llm',
        'Script generated',
        `${llmResult.script.length} chars, cost: $${llmResult.totalCost.toFixed(4)}`,
        `Attempt ${totalAttempts}`
      )

      // --- Phase 2: APS Execution ---
      addProgress(
        jobId,
        'aps',
        'Starting APS Design Automation...',
        'Uploading script to Autodesk cloud',
        `Attempt ${totalAttempts}`
      )

      const apsResult = await apsService.processTileWithProgress(
        llmResult.script,
        [], // No images for playground
        outputFilename.replace('.dwg', ''),
        (step, detail) => addProgress(jobId, 'aps', step, detail, `Attempt ${totalAttempts}`)
      )

      if (apsResult.success && apsResult.dwgBuffer) {
        // === SUCCESS ===
        const eurCost = await usdToEur(totalCost)
        const sizeKb = (apsResult.dwgBuffer.length / 1024).toFixed(1)

        // Note: Don't call addProgress with 'complete' phase here - completeJob does that
        // and we need the result object to be in the completion message
        completeJob(jobId, true, {
          dwgUrl: apsResult.dwgUrl,
          dwgBuffer: apsResult.dwgBuffer,
          viewerUrn: apsResult.viewerUrn,
          costEur: eurCost,
          llmModel: llmResult.model,
          tokensIn: llmResult.tokensIn,
          tokensOut: llmResult.tokensOut,
        }, `${sizeKb} KB, ${totalAttempts} attempt(s), cost: €${eurCost.toFixed(4)}`)
        return
      }

      // APS failed - extract error for retry
      lastApsError = apsResult.errors?.join('\n') || 'Unknown APS error'

      // Try to get more context from workItem report if available
      if (apsResult.workItemReport) {
        const detailedError = extractErrorContext(apsResult.workItemReport)
        if (detailedError) {
          lastApsError = detailedError
        }
      }

      addProgress(
        jobId,
        'error',
        'APS execution failed',
        lastApsError.slice(0, 200),
        `Attempt ${totalAttempts}`
      )

      if (totalAttempts >= MAX_TOTAL_ATTEMPTS) {
        completeJob(jobId, false, {
          errors: [`APS failed after ${totalAttempts} attempts: ${lastApsError}`],
        })
        return
      }

      // Continue to next attempt with error feedback
      addProgress(
        jobId,
        'llm',
        'Feeding error back to LLM for correction...',
        undefined,
        `Attempt ${totalAttempts}`
      )
    }

    // Should not reach here, but just in case
    completeJob(jobId, false, { errors: ['Max attempts exceeded'] })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    addProgress(jobId, 'error', 'Unexpected error', msg)
    completeJob(jobId, false, { errors: [msg] })
  }
}
