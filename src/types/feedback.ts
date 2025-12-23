/**
 * Feedback Chat Type Definitions
 *
 * Types for the AI-powered feedback chat system
 */

// ============================================================================
// Database Types (matching Supabase schema)
// ============================================================================

export interface FeedbackChat {
  id: string
  user_email: string
  subject: string | null
  status: 'active' | 'resolved' | 'archived'
  message_count: number
  total_tokens_used: number
  total_cost: number
  created_at: string
  updated_at: string
}

export interface FeedbackMessage {
  id: string
  chat_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments: Attachment[] | null
  tool_calls: ToolCall[] | null
  input_tokens: number | null
  output_tokens: number | null
  cost: number | null
  created_at: string
}

// ============================================================================
// Attachment Types
// ============================================================================

export type AttachmentType = 'image' | 'pdf' | 'screenshot'

export interface Attachment {
  type: AttachmentType
  url: string
  filename: string
  size: number // bytes
}

// ============================================================================
// Tool Call Types
// ============================================================================

export interface ToolCall {
  name: string
  input: Record<string, unknown>
  output: string
  duration_ms: number
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ChatRequest {
  chat_id?: string // Optional: continue existing chat
  message: string
  attachments?: Attachment[]
}

export interface ChatResponse {
  chat_id: string
  message: FeedbackMessage
}

export interface ChatListRequest {
  page?: number
  pageSize?: number
  status?: 'active' | 'resolved' | 'archived'
}

export interface ChatListResponse {
  chats: FeedbackChat[]
  total: number
  page: number
  pageSize: number
}

export interface UploadResponse {
  url: string
  filename: string
  size: number
  type: AttachmentType
}

// ============================================================================
// Streaming Types
// ============================================================================

export interface StreamChunk {
  type: 'text' | 'tool_use' | 'done' | 'error'
  content?: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  usage?: {
    input_tokens: number
    output_tokens: number
  }
  cost?: number
  error?: string
}

// ============================================================================
// UI State Types
// ============================================================================

export interface ChatUIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: Attachment[]
  isStreaming?: boolean
  input_tokens?: number
  output_tokens?: number
  cost?: number
  created_at: string
}

export interface ChatSession {
  id: string
  subject: string | null
  messages: ChatUIMessage[]
  totalCost: number
  isLoading: boolean
}
