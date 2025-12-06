import { NextResponse } from 'next/server'
import { getViewerToken } from '@/lib/tiles/aps-viewer'

/**
 * GET /api/viewer/auth
 * Returns viewer-only access token for Autodesk Viewer
 */
export async function GET() {
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
