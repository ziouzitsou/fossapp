import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listBucketDWGs, generateBucketName } from '@/lib/planner/aps-planner-service'

/**
 * GET /api/planner/files?projectId={uuid}
 *
 * List DWG files in a project's OSS bucket
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

  try {
    const files = await listBucketDWGs(projectId)

    return NextResponse.json({
      files,
      bucketName: generateBucketName(projectId)
    })
  } catch (error) {
    console.error('[Planner API] List files error:', error)
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    )
  }
}
