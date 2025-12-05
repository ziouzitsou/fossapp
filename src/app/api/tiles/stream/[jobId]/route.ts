/**
 * SSE Endpoint for streaming tile generation progress
 * GET /api/tiles/stream/[jobId]
 */

import { NextRequest } from 'next/server'
import { getJob, subscribe, ProgressMessage } from '@/lib/tiles/progress-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  const job = getJob(jobId)
  if (!job) {
    return new Response('Job not found', { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false

      const safeClose = () => {
        if (!isClosed) {
          isClosed = true
          try {
            controller.close()
          } catch {
            // Already closed
          }
        }
      }

      // Send existing messages first
      for (const msg of job.messages) {
        const data = `data: ${JSON.stringify(msg)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      // If job is already complete, send done event and close
      if (job.status !== 'running') {
        // Send a special "done" event so client knows to stop
        const doneData = `event: done\ndata: ${JSON.stringify({ status: job.status })}\n\n`
        controller.enqueue(encoder.encode(doneData))
        safeClose()
        return
      }

      // Subscribe to new messages
      const unsubscribe = subscribe(jobId, (msg: ProgressMessage) => {
        if (isClosed) return

        try {
          const data = `data: ${JSON.stringify(msg)}\n\n`
          controller.enqueue(encoder.encode(data))

          // Close stream when job completes
          if (msg.phase === 'complete' || msg.phase === 'error') {
            unsubscribe()
            // Send done event
            const doneData = `event: done\ndata: ${JSON.stringify({ status: msg.phase })}\n\n`
            try {
              controller.enqueue(encoder.encode(doneData))
            } catch {
              // Ignore
            }
            safeClose()
          }
        } catch {
          // Stream was closed
          unsubscribe()
          isClosed = true
        }
      })

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe()
        isClosed = true
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
