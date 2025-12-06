import { NextRequest, NextResponse } from 'next/server'
import { getTranslationStatus } from '@/lib/tiles/aps-viewer'

/**
 * GET /api/viewer/status/[urn]
 * Get translation status for a file
 *
 * Returns: { status: string, progress: string, messages?: string[] }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ urn: string }> }
) {
  try {
    const { urn } = await params

    if (!urn) {
      return NextResponse.json(
        { error: 'URN is required' },
        { status: 400 }
      )
    }

    const status = await getTranslationStatus(urn)
    return NextResponse.json(status)
  } catch (error) {
    console.error('Translation status error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    )
  }
}
