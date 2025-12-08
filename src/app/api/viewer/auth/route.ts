import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getViewerToken } from '@/lib/tiles/aps-viewer'

/**
 * GET /api/viewer/auth
 * Returns viewer-only access token for Autodesk Viewer
 * Requires authentication to prevent unauthorized access to APS tokens
 */
export async function GET() {
  // Security: Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const token = await getViewerToken()
    return NextResponse.json(token)
  } catch (error) {
    console.error('Viewer auth error:', error)
    return NextResponse.json(
      { error: 'Failed to get viewer token' },
      { status: 500 }
    )
  }
}
