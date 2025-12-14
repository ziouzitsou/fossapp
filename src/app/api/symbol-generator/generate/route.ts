/**
 * API Endpoint for Symbol DWG Generation
 * POST /api/symbol-generator/generate
 *
 * Flow:
 * 1. Receive symbol specification from vision analysis
 * 2. LLM converts spec to AutoLISP script
 * 3. APS Design Automation executes script
 * 4. Return DWG + PNG files
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit, rateLimitHeaders } from '@/lib/ratelimit'
import { createJob, addProgress, completeJob, generateJobId } from '@/lib/tiles/progress-store'
import { generateSymbolScript, retryScriptWithApsError } from '@/lib/symbol-generator/script-service'
import { symbolApsService } from '@/lib/symbol-generator/symbol-aps-service'
import { usdToEur } from '@/lib/currency'
import { LuminaireDimensions } from '@/lib/symbol-generator/types'
import { ProductInfo } from '@/types/product'

export const dynamic = 'force-dynamic'
export const maxDuration = 180 // 3 minutes max (LLM + APS)

interface GeneratePayload {
  product: ProductInfo
  spec: string           // Symbol specification from vision analysis
  dimensions: LuminaireDimensions
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = checkRateLimit(session.user.email, 'symbol-generator-dwg')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 10 symbol generations per minute.' },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      )
    }

    const payload: GeneratePayload = await request.json()

    if (!payload.spec || payload.spec.trim().length === 0) {
      return NextResponse.json({ error: 'Symbol specification is required' }, { status: 400 })
    }

    if (!payload.product?.foss_pid) {
      return NextResponse.json({ error: 'Product info is required' }, { status: 400 })
    }

    // Create job and return ID immediately
    const jobId = generateJobId()
    const fossPid = payload.product.foss_pid
    createJob(jobId, `Symbol: ${fossPid}`)

    // Start processing in background (don't await)
    processInBackground(jobId, payload)

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Symbol generation started',
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
 * Background processing: Spec → AutoLISP → APS → DWG + PNG
 */
async function processInBackground(jobId: string, payload: GeneratePayload) {
  const { product, spec, dimensions } = payload
  const fossPid = product.foss_pid

  const MAX_TOTAL_ATTEMPTS = 3
  let totalAttempts = 0
  let totalCost = 0
  let lastScript: string | undefined
  let lastApsError: string | undefined

  try {
    addProgress(jobId, 'llm', 'Starting symbol DWG generation', fossPid)

    // === ATTEMPT LOOP ===
    while (totalAttempts < MAX_TOTAL_ATTEMPTS) {
      totalAttempts++

      // --- Phase 1: LLM Script Generation ---
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
        // First attempt - fresh generation
        llmResult = await generateSymbolScript(
          spec,
          fossPid,
          dimensions,
          1, // Single attempt per call
          (attempt, model, status) => {
            addProgress(jobId, 'llm', status, `Model: ${model}`, `Attempt ${totalAttempts}`)
          }
        )
      } else {
        // Retry with APS error context
        llmResult = await retryScriptWithApsError(
          spec,
          fossPid,
          lastScript,
          lastApsError,
          (model, status) => {
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
      // Note: SAVEAS is already injected by extractScript() in script-service.ts

      addProgress(
        jobId,
        'llm',
        'Script generated',
        `${lastScript.length} chars, cost: $${llmResult.totalCost.toFixed(4)}`,
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

      const apsResult = await symbolApsService.processSymbol(
        lastScript,  // Use post-processed script with SAVEAS added
        fossPid,
        (step, detail) => addProgress(jobId, 'aps', step, detail, `Attempt ${totalAttempts}`)
      )

      if (apsResult.success && apsResult.dwgBuffer) {
        // === SUCCESS ===
        const eurCost = await usdToEur(totalCost)
        const dwgSizeKb = (apsResult.dwgBuffer.length / 1024).toFixed(1)
        const pngSizeKb = apsResult.pngBuffer ? (apsResult.pngBuffer.length / 1024).toFixed(1) : 'N/A'

        completeJob(jobId, true, {
          dwgBuffer: apsResult.dwgBuffer,
          pngBuffer: apsResult.pngBuffer,
          viewerUrn: apsResult.viewerUrn,
          costEur: eurCost,
          llmModel: llmResult.model,
          tokensIn: llmResult.tokensIn,
          tokensOut: llmResult.tokensOut,
        }, `DWG: ${dwgSizeKb} KB, PNG: ${pngSizeKb} KB, ${totalAttempts} attempt(s), cost: €${eurCost.toFixed(4)}`)
        return
      }

      // APS failed - extract error for retry
      lastApsError = apsResult.errors?.join('\n') || 'Unknown APS error'

      if (apsResult.workItemReport) {
        // Try to get more specific error from the report
        const lines = apsResult.workItemReport.split('\n')
        const errorLines = lines.filter(line => {
          const lower = line.toLowerCase()
          return (
            lower.includes('error') ||
            lower.includes('invalid') ||
            lower.includes('unknown') ||
            lower.includes('nil') ||
            lower.includes('bad argument') ||
            lower.includes('exception') ||
            lower.includes('; expected') ||
            lower.includes('requires') ||
            (lower.includes('command:') && !lower.includes('command: new')) // AutoCAD errors
          )
        })
        if (errorLines.length > 0) {
          lastApsError = errorLines.slice(-10).join('\n')
        } else {
          // If no specific errors, include last part of report
          lastApsError = apsResult.workItemReport.slice(-1000)
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

      addProgress(
        jobId,
        'llm',
        'Feeding error back to LLM for correction...',
        undefined,
        `Attempt ${totalAttempts}`
      )
    }

    // Should not reach here
    completeJob(jobId, false, { errors: ['Max attempts exceeded'] })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    addProgress(jobId, 'error', 'Unexpected error', msg)
    completeJob(jobId, false, { errors: [msg] })
  }
}
