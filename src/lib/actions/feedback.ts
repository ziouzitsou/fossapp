'use server'

/**
 * Feedback Chat Server Actions
 *
 * CRUD operations for the in-app feedback chat system.
 * Users can submit feedback, report bugs, and get AI-assisted help.
 *
 * @remarks
 * Schema: `feedback.chats` and `feedback.chat_messages`
 *
 * Features:
 * - Chat sessions with subject and status (active/resolved/archived)
 * - Messages with role (user/assistant/system)
 * - Attachments stored in Supabase Storage (feedback-attachments bucket)
 * - Token/cost tracking for AI messages
 * - Ownership verification (users can only access their own chats)
 *
 * Storage: Public feedback-attachments bucket with timestamped paths.
 *
 * @module actions/feedback
 */

import { supabaseServer } from '@fossapp/core/db/server'
import type {
  FeedbackChat,
  FeedbackMessage,
  Attachment,
  ToolCall,
} from '@/types/feedback'

// ============================================================================
// Chat Operations
// ============================================================================

/**
 * Create a new chat
 */
export async function createChatAction(
  userEmail: string,
  subject?: string
): Promise<FeedbackChat | null> {
  const { data, error } = await supabaseServer
    .schema('feedback')
    .from('chats')
    .insert({
      user_email: userEmail,
      subject: subject || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[Feedback] Failed to create chat:', error.message)
    return null
  }

  return data as FeedbackChat
}

/**
 * Get a chat by ID (with ownership verification)
 */
export async function getChatAction(
  chatId: string,
  userEmail: string
): Promise<FeedbackChat | null> {
  const { data, error } = await supabaseServer
    .schema('feedback')
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .eq('user_email', userEmail)
    .single()

  if (error) {
    console.error('[Feedback] Failed to get chat:', error.message)
    return null
  }

  return data as FeedbackChat
}

/**
 * Get user's chat history with pagination
 */
export async function getUserChatsAction(
  userEmail: string,
  options: {
    page?: number
    pageSize?: number
    status?: 'active' | 'resolved' | 'archived'
  } = {}
): Promise<{ chats: FeedbackChat[]; total: number }> {
  const page = options.page || 1
  const pageSize = Math.min(options.pageSize || 20, 50) // Max 50 per page
  const offset = (page - 1) * pageSize

  let query = supabaseServer
    .schema('feedback')
    .from('chats')
    .select('*', { count: 'exact' })
    .eq('user_email', userEmail)
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (options.status) {
    query = query.eq('status', options.status)
  }

  const { data, count, error } = await query

  if (error) {
    console.error('[Feedback] Failed to get user chats:', error.message)
    return { chats: [], total: 0 }
  }

  return {
    chats: (data as FeedbackChat[]) || [],
    total: count || 0,
  }
}

/**
 * Update chat status
 */
export async function updateChatStatusAction(
  chatId: string,
  userEmail: string,
  status: 'active' | 'resolved' | 'archived'
): Promise<boolean> {
  const { error } = await supabaseServer
    .schema('feedback')
    .from('chats')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chatId)
    .eq('user_email', userEmail)

  if (error) {
    console.error('[Feedback] Failed to update chat status:', error.message)
    return false
  }

  return true
}

/**
 * Update chat subject
 */
export async function updateChatSubjectAction(
  chatId: string,
  userEmail: string,
  subject: string
): Promise<boolean> {
  const { error } = await supabaseServer
    .schema('feedback')
    .from('chats')
    .update({
      subject: subject.substring(0, 200), // Limit subject length
      updated_at: new Date().toISOString(),
    })
    .eq('id', chatId)
    .eq('user_email', userEmail)

  if (error) {
    console.error('[Feedback] Failed to update chat subject:', error.message)
    return false
  }

  return true
}

/**
 * Delete a chat (and all its messages via CASCADE)
 */
export async function deleteChatAction(
  chatId: string,
  userEmail: string
): Promise<boolean> {
  const { error } = await supabaseServer
    .schema('feedback')
    .from('chats')
    .delete()
    .eq('id', chatId)
    .eq('user_email', userEmail)

  if (error) {
    console.error('[Feedback] Failed to delete chat:', error.message)
    return false
  }

  return true
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Get messages for a chat (with ownership verification)
 */
export async function getChatMessagesAction(
  chatId: string,
  userEmail: string
): Promise<FeedbackMessage[]> {
  // First verify chat belongs to user
  const chat = await getChatAction(chatId, userEmail)
  if (!chat) {
    return []
  }

  const { data, error } = await supabaseServer
    .schema('feedback')
    .from('chat_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[Feedback] Failed to get chat messages:', error.message)
    return []
  }

  return (data as FeedbackMessage[]) || []
}

/**
 * Add a message to a chat
 */
export async function addMessageAction(
  chatId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  options?: {
    attachments?: Attachment[]
    tool_calls?: ToolCall[]
    input_tokens?: number
    output_tokens?: number
    cost?: number
  }
): Promise<FeedbackMessage | null> {
  const { data, error } = await supabaseServer
    .schema('feedback')
    .from('chat_messages')
    .insert({
      chat_id: chatId,
      role,
      content,
      attachments: options?.attachments || null,
      tool_calls: options?.tool_calls || null,
      input_tokens: options?.input_tokens || null,
      output_tokens: options?.output_tokens || null,
      cost: options?.cost || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[Feedback] Failed to add message:', error.message)
    return null
  }

  return data as FeedbackMessage
}

/**
 * Get the last N messages from a chat (for context window)
 */
export async function getRecentMessagesAction(
  chatId: string,
  limit: number = 20
): Promise<FeedbackMessage[]> {
  const { data, error } = await supabaseServer
    .schema('feedback')
    .from('chat_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[Feedback] Failed to get recent messages:', error.message)
    return []
  }

  // Reverse to get chronological order
  return ((data as FeedbackMessage[]) || []).reverse()
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Get a signed URL for uploading to feedback-attachments bucket
 */
export async function getUploadUrlAction(
  chatId: string,
  filename: string
): Promise<{ signedUrl: string; path: string } | null> {
  const timestamp = Date.now()
  const extension = filename.split('.').pop() || 'bin'
  const path = `${chatId}/${timestamp}.${extension}`

  const { data, error } = await supabaseServer.storage
    .from('feedback-attachments')
    .createSignedUploadUrl(path)

  if (error) {
    console.error('[Feedback] Failed to get upload URL:', error.message)
    return null
  }

  return {
    signedUrl: data.signedUrl,
    path,
  }
}

/**
 * Get public URL for an attachment
 */
export async function getAttachmentUrlAction(path: string): Promise<string> {
  const { data } = supabaseServer.storage
    .from('feedback-attachments')
    .getPublicUrl(path)

  return data.publicUrl
}

/**
 * Get chat with all messages (for email notifications)
 * Does NOT verify user ownership - use only in server contexts
 */
export async function getChatWithMessagesAction(
  chatId: string
): Promise<{ chat: FeedbackChat; messages: FeedbackMessage[] } | null> {
  // Get chat
  const { data: chat, error: chatError } = await supabaseServer
    .schema('feedback')
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single()

  if (chatError || !chat) {
    console.error('[Feedback] Failed to get chat for email:', chatError?.message)
    return null
  }

  // Get messages
  const { data: messages, error: msgError } = await supabaseServer
    .schema('feedback')
    .from('chat_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })

  if (msgError) {
    console.error('[Feedback] Failed to get messages for email:', msgError.message)
    return null
  }

  return {
    chat: chat as FeedbackChat,
    messages: (messages as FeedbackMessage[]) || [],
  }
}
