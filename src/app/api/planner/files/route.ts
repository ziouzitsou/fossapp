import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listBucketDWGs, generateBucketName } from '@/lib/planner/aps-planner-service'

/**
 * GET /api/planner/files?projectId={uuid}&areaId={uuid}&versionId={uuid}
 *
 * List DWG files in a project's OSS bucket
 *
 * Query params:
 *   - projectId: Required - Project UUID
 *   - areaId: Optional - Filter to specific area
 *   - versionId: Optional - Filter to specific version (requires areaId)
 *
 * Returns files organized by area/version with URNs for viewer loading
 */
export async function GET(request: NextRequest) {
  // Security: Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  const areaId = searchParams.get('areaId')
  const versionId = searchParams.get('versionId')

  if (!projectId) {
    return NextResponse.json(
      { error: 'No projectId provided' },
      { status: 400 }
    )
  }

  // Validate project ID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(projectId)) {
    return NextResponse.json(
      { error: 'Invalid project ID format' },
      { status: 400 }
    )
  }

  // Validate optional areaId
  if (areaId && !uuidRegex.test(areaId)) {
    return NextResponse.json(
      { error: 'Invalid area ID format' },
      { status: 400 }
    )
  }

  // Validate optional versionId
  if (versionId && !uuidRegex.test(versionId)) {
    return NextResponse.json(
      { error: 'Invalid version ID format' },
      { status: 400 }
    )
  }

  // versionId requires areaId
  if (versionId && !areaId) {
    return NextResponse.json(
      { error: 'versionId requires areaId' },
      { status: 400 }
    )
  }

  try {
    const files = await listBucketDWGs(projectId, {
      areaId: areaId || undefined,
      versionId: versionId || undefined
    })

    return NextResponse.json({
      files,
      bucketName: generateBucketName(projectId),
      filters: {
        areaId: areaId || null,
        versionId: versionId || null
      }
    })
  } catch (error) {
    console.error('[Planner API] List files error:', error)
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    )
  }
}
