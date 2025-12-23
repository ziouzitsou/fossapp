/**
 * Feedback Chat Status API Route
 *
 * POST: Update chat status (resolve, archive, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { updateChatStatusAction, getChatAction } from '@/lib/actions/feedback'

export async function POST(request: NextRequest) {
  // Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    )
  }

  const userEmail = session.user.email

  try {
    const body = await request.json()
    const { chat_id, status } = body as {
      chat_id: string
      status: 'active' | 'resolved' | 'archived'
    }

    // Validate inputs
    if (!chat_id || !status) {
      return NextResponse.json(
        { error: 'chat_id and status are required' },
        { status: 400 }
      )
    }

    if (!['active', 'resolved', 'archived'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be active, resolved, or archived' },
        { status: 400 }
      )
    }

    // Verify chat exists and belongs to user
    const chat = await getChatAction(chat_id, userEmail)
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found or access denied' },
        { status: 404 }
      )
    }

    // Update status
    const success = await updateChatStatusAction(chat_id, userEmail, status)
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update chat status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      chat_id,
      status,
    })
  } catch (error) {
    console.error('[Feedback Status API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update status' },
      { status: 500 }
    )
  }
}
