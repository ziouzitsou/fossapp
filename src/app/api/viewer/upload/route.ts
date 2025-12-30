import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prepareForViewing } from '@/lib/tiles/aps-viewer'
import { getGoogleDriveTileService } from '@/lib/tiles/google-drive-tile-service'
import { checkRateLimit, rateLimitHeaders } from '@fossapp/core/ratelimit'

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
function sanitizeFileName(filename: string): string {
  // Decode URL-encoded characters first (catches %2F, %2E attacks)
  let decoded = filename
  try {
    let prev = ''
    while (prev !== decoded) {
      prev = decoded
      decoded = decodeURIComponent(decoded)
    }
  } catch {
    decoded = filename
  }

  // Extract basename (remove any path components)
  const basename = decoded.split(/[/\\]/).pop() || decoded

  // Remove path traversal and dangerous characters, whitelist safe chars
  return basename
    .replace(/\.\./g, '')
    .replace(/\.\//g, '')
    .replace(/\.\\/g, '')
    .replace(/[^a-zA-Z0-9\s.\-_()]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .toLowerCase() || 'upload'
}

/**
 * POST /api/viewer/upload
 * Upload DWG file (and associated images) for viewing
 * Requires authentication to prevent service abuse
 *
 * Body: FormData with either:
 *   - 'file' field (File upload - DWG only, no images)
 *   - 'driveFileId' + 'fileName' fields (Download from Google Drive - includes images)
 * Returns: { urn: string, expiresAt: number }
 */
export async function POST(request: NextRequest) {
  // Security: Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Rate limiting
  const rateLimit = checkRateLimit(session.user.email, 'viewer-upload')
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 20 uploads per minute.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    )
  }

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
      finalFileName = file.name
      const arrayBuffer = await file.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    } else if (driveFileId && fileName) {
      // Download from Google Drive (includes all images in folder)
      console.log('Downloading tile files from Google Drive:', driveFileId)
      const driveService = getGoogleDriveTileService()
      const tileFiles = await driveService.downloadTileFiles(driveFileId)

      buffer = tileFiles.dwg.buffer
      finalFileName = fileName
      images = tileFiles.images

      console.log(`Downloaded from Drive: ${(buffer.length / 1024).toFixed(0)} KB DWG + ${images.length} images`)
    } else {
      return NextResponse.json(
        { error: 'No file or driveFileId provided' },
        { status: 400 }
      )
    }

    // Sanitize filename (prevents path traversal, URL-encoded attacks, etc.)
    const sanitizedFileName = sanitizeFileName(finalFileName)

    // Validate file extension
    const validExtensions = ['.dwg', '.dxf']
    const hasValidExtension = validExtensions.some(ext => sanitizedFileName.endsWith(ext))

    if (!hasValidExtension) {
      return NextResponse.json(
        { error: 'Invalid file type. Only DWG and DXF files are supported.' },
        { status: 400 }
      )
    }

    // Upload and start translation (with images if available)
    const result = await prepareForViewing(sanitizedFileName, buffer, images)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Viewer upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}
