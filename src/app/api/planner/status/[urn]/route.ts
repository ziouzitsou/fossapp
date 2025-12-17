import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTranslationStatus } from '@/lib/planner/aps-planner-service'

/**
 * GET /api/planner/status/[urn]
 *
 * Get translation status for a floor plan URN
 * Returns: { status: string, progress: string, messages?: string[] }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ urn: string }> }
) {
  // Security: Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { urn } = await params

    if (!urn) {
      return NextResponse.json(
        { error: 'No URN provided' },
        { status: 400 }
      )
    }

    // Decode URN if it was URL-encoded
    const decodedUrn = decodeURIComponent(urn)

    const status = await getTranslationStatus(decodedUrn)

    return NextResponse.json(status)
  } catch (error) {
    console.error('[Planner API] Status error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    )
  }
}
