import { NextRequest, NextResponse } from 'next/server'
import { getGoogleDriveTileService } from '@/lib/tiles/google-drive-tile-service'

/**
 * GET /api/tiles/drive-download?fileId=xxx
 * Download a file from Google Drive by its ID
 * Returns the file as binary data
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId parameter is required' },
        { status: 400 }
      )
    }

    const driveService = getGoogleDriveTileService()
    const buffer = await driveService.downloadFile(fileId)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="file.dwg"`,
        'Content-Length': buffer.length.toString(),
      }
    })
  } catch (error) {
    console.error('Drive download error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download file' },
      { status: 500 }
    )
  }
}
