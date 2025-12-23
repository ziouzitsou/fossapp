/**
 * Feedback Chat API Route
 *
 * POST: Send a message and get AI response (with SSE streaming)
 * GET: List user chats or get chat messages
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkRateLimit, rateLimitHeaders } from '@/lib/ratelimit'
import {
  createChatAction,
  getChatAction,
  getChatMessagesAction,
  addMessageAction,
  getUserChatsAction,
  getRecentMessagesAction,
} from '@/lib/actions/feedback'
import { runFeedbackAgent, type StreamEvent, type AgentMessage } from '@/lib/feedback/agent'
import { logEvent } from '@/lib/event-logger'
import type { Attachment, ToolCall } from '@/types/feedback'

// ============================================================================
// POST: Send message with streaming response
// ============================================================================

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

  // Rate limiting
  const rateLimit = checkRateLimit(userEmail, 'feedback-chat')
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before sending more messages.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    )
  }

  try {
    const body = await request.json()
    const { chat_id, message, attachments } = body as {
      chat_id?: string
      message: string
      attachments?: Attachment[]
    }

    // Validate message (allow empty message if attachments present)
    const hasAttachments = attachments && attachments.length > 0
    if (!hasAttachments && (!message || typeof message !== 'string' || message.trim().length === 0)) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Default message for screenshot-only submissions
    const sanitizedMessage = message?.trim()?.substring(0, 10000) ||
      (hasAttachments ? 'Please analyze this screenshot.' : '')

    // Get or create chat
    let chatId = chat_id
    let isNewChat = false

    if (!chatId) {
      // Create new chat with first message as subject
      const subject = sanitizedMessage.substring(0, 100)
      const newChat = await createChatAction(userEmail, subject)
      if (!newChat) {
        return NextResponse.json(
          { error: 'Failed to create chat' },
          { status: 500 }
        )
      }
      chatId = newChat.id
      isNewChat = true
    } else {
      // Verify chat exists and belongs to user
      const existingChat = await getChatAction(chatId, userEmail)
      if (!existingChat) {
        return NextResponse.json(
          { error: 'Chat not found or access denied' },
          { status: 404 }
        )
      }
    }

    // Store user message
    const userMessage = await addMessageAction(chatId, 'user', sanitizedMessage, {
      attachments: attachments || undefined,
    })
    if (!userMessage) {
      return NextResponse.json(
        { error: 'Failed to store message' },
        { status: 500 }
      )
    }

    // Get chat history for context (last 20 messages)
    const chatHistory = await getRecentMessagesAction(chatId, 20)
    const formattedHistory: AgentMessage[] = chatHistory
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        attachments: m.attachments || undefined,
      }))

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: StreamEvent) => {
          const data = JSON.stringify(event)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }

        // Send initial event with chat_id
        sendEvent({ type: 'text', content: '', toolName: chatId })

        try {
          // Run agent with streaming
          const result = await runFeedbackAgent(formattedHistory, sendEvent)

          // Store assistant message
          await addMessageAction(chatId, 'assistant', result.content, {
            tool_calls: result.toolCalls as ToolCall[],
            input_tokens: result.inputTokens,
            output_tokens: result.outputTokens,
            cost: result.cost,
          })

          // Log event
          await logEvent('feedback_chat', userEmail, {
            eventData: {
              chat_id: chatId,
              is_new_chat: isNewChat,
              message_length: sanitizedMessage.length,
              input_tokens: result.inputTokens,
              output_tokens: result.outputTokens,
              cost: result.cost,
              tool_calls: result.toolCalls.length,
              has_attachments: !!attachments?.length,
            },
            pathname: '/feedback',
          })
        } catch (error) {
          console.error('[Feedback API] Agent error:', error)
          sendEvent({
            type: 'error',
            error: error instanceof Error ? error.message : 'Agent error',
          })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Chat-ID': chatId,
      },
    })
  } catch (error) {
    console.error('[Feedback API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process message' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET: List chats or get chat messages
// ============================================================================

export async function GET(request: NextRequest) {
  // Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    )
  }

  const userEmail = session.user.email
  const { searchParams } = new URL(request.url)
  const chatId = searchParams.get('chat_id')

  try {
    if (chatId) {
      // Get specific chat messages
      const messages = await getChatMessagesAction(chatId, userEmail)
      const chat = await getChatAction(chatId, userEmail)

      if (!chat) {
        return NextResponse.json(
          { error: 'Chat not found or access denied' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        chat,
        messages,
      })
    }

    // List user's chats
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const status = searchParams.get('status') as
      | 'active'
      | 'resolved'
      | 'archived'
      | null

    const { chats, total } = await getUserChatsAction(userEmail, {
      page,
      pageSize,
      status: status || undefined,
    })

    return NextResponse.json({
      chats,
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[Feedback API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat data' },
      { status: 500 }
    )
  }
}
