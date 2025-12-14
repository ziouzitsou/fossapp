/**
 * Download endpoint for Symbol DWG/PNG files
 * GET /api/symbol-generator/download/[jobId]?type=dwg|png
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getJob } from '@/lib/tiles/progress-store'

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
    const searchParams = request.nextUrl.searchParams
    const fileType = searchParams.get('type') || 'dwg'

    // Get job from progress store
    const job = getJob(jobId)

    if (!job) {
      return NextResponse.json({ error: 'Job not found or expired' }, { status: 404 })
    }

    if (fileType === 'png') {
      if (!job.pngBuffer) {
        return NextResponse.json({ error: 'PNG file not available' }, { status: 404 })
      }

      return new NextResponse(new Uint8Array(job.pngBuffer), {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': 'attachment; filename="Symbol.png"',
          'Content-Length': String(job.pngBuffer.length),
        },
      })
    } else {
      // Default to DWG
      if (!job.dwgBuffer) {
        return NextResponse.json({ error: 'DWG file not available' }, { status: 404 })
      }

      return new NextResponse(new Uint8Array(job.dwgBuffer), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="Symbol.dwg"',
          'Content-Length': String(job.dwgBuffer.length),
        },
      })
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
