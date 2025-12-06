import { NextRequest, NextResponse } from 'next/server'
import { prepareForViewing } from '@/lib/tiles/aps-viewer'
import { getGoogleDriveTileService } from '@/lib/tiles/google-drive-tile-service'

/**
 * POST /api/viewer/upload
 * Upload DWG file (and associated images) for viewing
 *
 * Body: FormData with either:
 *   - 'file' field (File upload - DWG only, no images)
 *   - 'driveFileId' + 'fileName' fields (Download from Google Drive - includes images)
 * Returns: { urn: string, expiresAt: number }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const driveFileId = formData.get('driveFileId') as string | null
    const fileName = formData.get('fileName') as string | null

    let buffer: Buffer
    let finalFileName: string
    let images: Array<{ name: string; buffer: Buffer }> = []

    if (file) {
      // Direct file upload (no images)
      finalFileName = file.name.toLowerCase()
      const arrayBuffer = await file.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    } else if (driveFileId && fileName) {
      // Download from Google Drive (includes all images in folder)
      console.log('Downloading tile files from Google Drive:', driveFileId)
      const driveService = getGoogleDriveTileService()
      const tileFiles = await driveService.downloadTileFiles(driveFileId)

      buffer = tileFiles.dwg.buffer
      finalFileName = fileName.toLowerCase()
      images = tileFiles.images

      console.log(`Downloaded from Drive: ${(buffer.length / 1024).toFixed(0)} KB DWG + ${images.length} images`)
    } else {
      return NextResponse.json(
        { error: 'No file or driveFileId provided' },
        { status: 400 }
      )
    }

    // Validate file extension
    const validExtensions = ['.dwg', '.dxf']
    const hasValidExtension = validExtensions.some(ext => finalFileName.endsWith(ext))

    if (!hasValidExtension) {
      return NextResponse.json(
        { error: 'Invalid file type. Only DWG and DXF files are supported.' },
        { status: 400 }
      )
    }

    // Upload and start translation (with images if available)
    const result = await prepareForViewing(finalFileName, buffer, images)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Viewer upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}
