/**
 * Feedback Chat Status API Route
 *
 * POST: Update chat status (resolve, archive, etc.)
 * Sends email notification when status changes to 'resolved'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import {
  updateChatStatusAction,
  getChatAction,
  getChatWithMessagesAction,
} from '@/lib/actions/feedback'
import { sendFeedbackNotification } from '@/lib/feedback/email'

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

    // Send email notification when feedback is submitted (resolved)
    let emailSent = false
    if (status === 'resolved') {
      const chatData = await getChatWithMessagesAction(chat_id)
      if (chatData) {
        const emailResult = await sendFeedbackNotification({
          chatId: chat_id,
          userEmail: chatData.chat.user_email,
          subject: chatData.chat.subject,
          messages: chatData.messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            created_at: m.created_at,
          })),
          totalCost: chatData.chat.total_cost || 0,
          messageCount: chatData.chat.message_count || 0,
        })
        emailSent = emailResult.success
        if (!emailResult.success) {
          console.error('[Feedback Status] Email failed:', emailResult.error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      chat_id,
      status,
      emailSent,
    })
  } catch (error) {
    console.error('[Feedback Status API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update status' },
      { status: 500 }
    )
  }
}
