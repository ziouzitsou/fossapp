/**
 * API Endpoint for starting tile generation with streaming progress
 * POST /api/tiles/generate
 *
 * Returns jobId immediately, client subscribes to SSE for progress
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit, rateLimitHeaders } from '@fossapp/core/ratelimit'
import { createJob, addProgress, completeJob, generateJobId } from '@fossapp/tiles/progress'
import { processTileImages, generateScript, TilePayload } from '@/lib/tiles/actions'
import { apsService } from '@/lib/tiles/aps-service'
import { getGoogleDriveTileService } from '@/lib/tiles/google-drive-tile-service'
import { base64ToBuffer } from '@/lib/tiles/image-processor'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutes max

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ✅ Rate limiting (strict for expensive tile generation)
    const rateLimit = checkRateLimit(session.user.email, 'tiles-generate')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 5 tile generations per minute.' },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      )
    }

    const payload: TilePayload = await request.json()

    // Create job and return ID immediately
    const jobId = generateJobId()
    createJob(jobId, payload.tile)

    // Start processing in the background (don't await)
    processInBackground(jobId, payload)

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Tile generation started',
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
 * Background processing function - pushes updates to progress store
 */
async function processInBackground(jobId: string, payload: TilePayload) {
  try {
    addProgress(jobId, 'images', 'Starting tile generation', `${payload.tile} (${payload.members.length} members)`)

    // Step 1: Process images
    addProgress(jobId, 'images', 'Processing images...', `${payload.members.length * 2} files (images + drawings)`, 'Step 1/4')
    const imageResult = await processTileImages(payload)

    if (!imageResult.success || imageResult.processedImages.length === 0) {
      const errorMsg = imageResult.errors.length > 0
        ? imageResult.errors.join(', ')
        : 'No images were processed successfully'
      addProgress(jobId, 'error', 'Image processing failed', errorMsg)
      completeJob(jobId, false, { errors: [errorMsg] })
      return
    }
    addProgress(jobId, 'images', 'Images processed', `${imageResult.processedImages.length} files converted`, 'Step 1/4')

    // Step 2: Generate script
    addProgress(jobId, 'script', 'Generating AutoLISP script...', undefined, 'Step 2/4')
    const scriptResult = await generateScript(payload)
    addProgress(jobId, 'script', 'Script generated', `${scriptResult.scriptLines} lines`, 'Step 2/4')

    // Step 3: APS Design Automation
    addProgress(jobId, 'aps', 'Starting APS Design Automation...', undefined, 'Step 3/4')

    // Prepare image buffers
    const imageBuffers = imageResult.processedImages.map((img) => ({
      filename: img.filename,
      buffer: base64ToBuffer(img.base64),
    }))

    // Process with APS (with progress callbacks)
    const apsResult = await apsService.processTileWithProgress(
      scriptResult.script,
      imageBuffers,
      payload.tile,
      (step, detail) => addProgress(jobId, 'aps', step, detail, 'Step 3/4')
    )

    if (!apsResult.success) {
      addProgress(jobId, 'error', 'APS processing failed', apsResult.errors.join(', '))
      completeJob(jobId, false, { errors: apsResult.errors })
      return
    }

    // Step 4: Upload to Google Drive
    if (apsResult.dwgBuffer) {
      addProgress(jobId, 'drive', 'Uploading to Google Drive...', `${(apsResult.dwgBuffer.length / 1024).toFixed(0)} KB DWG + ${imageResult.processedImages.length} images`, 'Step 4/4')

      try {
        const imagesToUpload = imageResult.processedImages.map((img) => ({
          name: img.filename,
          buffer: base64ToBuffer(img.base64),
        }))

        const driveService = getGoogleDriveTileService()
        const driveResult = await driveService.uploadTileFiles(
          payload.tile,
          apsResult.dwgBuffer,
          imagesToUpload,
          apsResult.workItemReport,
          scriptResult.script // Include .scr for local testing with accoreconsole.exe
        )

        if (driveResult.success) {
          // Find the DWG file ID from uploaded files
          const dwgFile = driveResult.files.find(f => f.name.endsWith('.dwg'))
          const dwgFileId = dwgFile?.id

          addProgress(jobId, 'drive', 'Google Drive upload complete', driveResult.tileFolderLink, 'Step 4/4')
          completeJob(jobId, true, {
            dwgUrl: apsResult.dwgUrl,
            dwgFileId,
            driveLink: driveResult.tileFolderLink,
            viewerUrn: apsResult.viewerUrn,
          })
        } else {
          addProgress(jobId, 'error', 'Google Drive upload failed', driveResult.errors.join(', '))
          completeJob(jobId, false, {
            dwgUrl: apsResult.dwgUrl,
            errors: driveResult.errors,
          })
        }
      } catch (driveError) {
        const msg = driveError instanceof Error ? driveError.message : 'Unknown error'
        addProgress(jobId, 'error', 'Google Drive upload failed', msg)
        completeJob(jobId, false, {
          dwgUrl: apsResult.dwgUrl,
          errors: [`Drive upload failed: ${msg}`],
        })
      }
    } else {
      completeJob(jobId, false, { errors: ['No DWG buffer returned from APS'] })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    addProgress(jobId, 'error', 'Unexpected error', msg)
    completeJob(jobId, false, { errors: [msg] })
  }
}
