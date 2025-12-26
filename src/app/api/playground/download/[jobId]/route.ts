/**
 * Download endpoint for Playground DWG files
 * GET /api/playground/download/[jobId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getJob } from '@fossapp/tiles/progress'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { jobId } = await params

    // Get job from progress store
    const job = getJob(jobId)

    if (!job) {
      return NextResponse.json({ error: 'Job not found or expired' }, { status: 404 })
    }

    if (!job.dwgBuffer) {
      return NextResponse.json({ error: 'DWG file not available' }, { status: 404 })
    }

    // Return DWG file (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(job.dwgBuffer), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="Playground.dwg"',
        'Content-Length': String(job.dwgBuffer.length),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
