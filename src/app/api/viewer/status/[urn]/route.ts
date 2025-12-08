import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTranslationStatus } from '@/lib/tiles/aps-viewer'
import { checkRateLimit, rateLimitHeaders } from '@/lib/ratelimit'

/**
 * GET /api/viewer/status/[urn]
 * Get translation status for a file
 * Requires authentication to prevent URN enumeration
 *
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

  // Rate limiting (generous for polling)
  const rateLimit = checkRateLimit(session.user.email, 'viewer-status')
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    )
  }

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
