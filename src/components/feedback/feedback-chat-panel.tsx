'use client'

/**
 * Feedback Chat Panel
 *
 * Slide-out panel for AI-powered feedback chat.
 * Features: streaming responses, file uploads, screenshots, cost tracking.
 *
 * Memory persistence: Chat survives page navigation and refresh until explicit submit.
 * - chatId stored in localStorage
 * - Messages loaded from DB on panel mount
 * - Clear on "Submit Feedback" or "New Chat"
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Textarea } from '@fossapp/ui'
import { ScrollArea } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import {
  Send,
  Camera,
  Paperclip,
  Loader2,
  X,
  MessageCircle,
  Plus,
  CheckCircle,
} from 'lucide-react'
import { ChatMessage } from './chat-message'
import { captureAndUploadScreenshot, uploadFile } from '@/lib/feedback/screenshot'
import { formatCostEur, getUsdToEurRate } from '@/lib/feedback/pricing'
import { toast } from 'sonner'
import type { ChatUIMessage, Attachment, StreamChunk, FeedbackMessage } from '@/types/feedback'

// localStorage key for persisting chat across page navigation
const CHAT_ID_STORAGE_KEY = 'fossapp_feedback_chat_id'
// sessionStorage key to prevent repeated "restored" toasts on navigation
const HISTORY_RESTORED_KEY = 'fossapp_feedback_history_restored'

/**
 * Props for the FeedbackChatPanel component.
 */
interface FeedbackChatPanelProps {
  /** Controls whether the slide-out panel is visible */
  open: boolean
  /** Callback when panel visibility should change (e.g., close button, overlay click) */
  onOpenChange: (open: boolean) => void
}

/**
 * AI-powered feedback chat panel that slides out from the right side of the screen.
 *
 * @remarks
 * **Persistence**: Conversations persist across page navigation using localStorage
 * for the chat ID. Messages are stored in Supabase and restored on mount.
 *
 * **Features**:
 * - Streaming AI responses via SSE
 * - Screenshot capture (hides panel, captures, reopens)
 * - File uploads (images, PDFs)
 * - Cost tracking (displayed in EUR)
 *
 * **Lifecycle**:
 * 1. User opens panel → Previous chat restored from localStorage if exists
 * 2. User sends messages → Stored in DB with streaming responses
 * 3. User clicks "Submit" → Chat marked as resolved, state cleared
 * 4. User clicks "New Chat" → State cleared, new conversation starts
 */
export function FeedbackChatPanel({ open, onOpenChange }: FeedbackChatPanelProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<ChatUIMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [sessionCost, setSessionCost] = useState(0)
  const [historyRestored, setHistoryRestored] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Prefetch exchange rate on mount
  useEffect(() => {
    getUsdToEurRate() // Cache the rate for cost display
  }, [])

  /**
   * Load chat history from API
   * Called when restoring a chat from localStorage
   */
  const loadChatHistory = useCallback(async (savedChatId: string) => {
    if (!session?.user?.email) return false

    setIsLoadingHistory(true)
    try {
      const response = await fetch(`/api/feedback/chat?chat_id=${savedChatId}`)

      if (!response.ok) {
        // Chat not found or doesn't belong to user - clear storage
        localStorage.removeItem(CHAT_ID_STORAGE_KEY)
        return false
      }

      const data = await response.json()

      // Check if chat is still active (not resolved/archived)
      if (data.chat?.status !== 'active') {
        localStorage.removeItem(CHAT_ID_STORAGE_KEY)
        return false
      }

      // Convert FeedbackMessage[] to ChatUIMessage[]
      const loadedMessages: ChatUIMessage[] = data.messages.map((m: FeedbackMessage) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        attachments: m.attachments || undefined,
        input_tokens: m.input_tokens || undefined,
        output_tokens: m.output_tokens || undefined,
        cost: m.cost || undefined,
        created_at: m.created_at,
      }))

      // Calculate session cost from loaded messages
      const totalCost = loadedMessages.reduce((sum, m) => sum + (m.cost || 0), 0)

      setMessages(loadedMessages)
      setChatId(savedChatId)
      setSessionCost(totalCost)
      return true
    } catch (error) {
      console.error('[FeedbackChat] Error loading history:', error)
      localStorage.removeItem(CHAT_ID_STORAGE_KEY)
      return false
    } finally {
      setIsLoadingHistory(false)
    }
  }, [session?.user?.email])

  /**
   * Restore chat from localStorage on mount
   * Only runs once per browser session (uses sessionStorage to track)
   */
  useEffect(() => {
    if (historyRestored || !session?.user?.email) return

    // Check sessionStorage to prevent repeated toasts on page navigation
    const alreadyRestored = sessionStorage.getItem(HISTORY_RESTORED_KEY)
    const savedChatId = localStorage.getItem(CHAT_ID_STORAGE_KEY)

    if (savedChatId) {
      loadChatHistory(savedChatId).then((success) => {
        // Only show toast once per browser session
        if (success && !alreadyRestored) {
          toast.info('Previous conversation restored')
          sessionStorage.setItem(HISTORY_RESTORED_KEY, 'true')
        }
      })
    }
    setHistoryRestored(true)
  }, [session?.user?.email, historyRestored, loadChatHistory])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      // ScrollArea uses Radix UI - the actual scrollable element is the Viewport inside
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  /**
   * Send message and handle streaming response
   */
  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() && pendingAttachments.length === 0) return
    if (isLoading) return

    const userMessage: ChatUIMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
      created_at: new Date().toISOString(),
    }

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setPendingAttachments([])
    setIsLoading(true)

    // Create placeholder for assistant response
    const assistantId = `assistant-${Date.now()}`
    const assistantMessage: ChatUIMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, assistantMessage])

    try {
      const response = await fetch('/api/feedback/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message: userMessage.content,
          attachments: userMessage.attachments,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      // Get chat ID from header and persist to localStorage
      const responseChatId = response.headers.get('X-Chat-ID')
      if (responseChatId && !chatId) {
        setChatId(responseChatId)
        localStorage.setItem(CHAT_ID_STORAGE_KEY, responseChatId)
      }

      // Read SSE stream
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: StreamChunk = JSON.parse(line.slice(6))

              switch (event.type) {
                case 'text':
                  if (event.content) {
                    fullContent += event.content
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, content: fullContent }
                          : m
                      )
                    )
                  }
                  break

                case 'done':
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            content: fullContent,
                            isStreaming: false,
                            input_tokens: event.usage?.input_tokens,
                            output_tokens: event.usage?.output_tokens,
                            cost: event.cost,
                          }
                        : m
                    )
                  )
                  if (event.cost) {
                    setSessionCost((prev) => prev + event.cost!)
                  }
                  break

                case 'error':
                  throw new Error(event.error || 'Stream error')
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send message')

      // Remove failed assistant message
      setMessages((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setIsLoading(false)
    }
  }, [inputValue, pendingAttachments, chatId, isLoading])

  /**
   * Handle screenshot capture
   */
  const handleScreenshot = useCallback(async () => {
    if (isCapturing) return

    setIsCapturing(true)
    try {
      // Temporarily close panel to capture clean screenshot
      onOpenChange(false)
      await new Promise((resolve) => setTimeout(resolve, 300))

      const result = await captureAndUploadScreenshot(chatId || undefined)

      // Reopen panel
      onOpenChange(true)

      setPendingAttachments((prev) => [
        ...prev,
        {
          type: 'screenshot',
          url: result.url,
          filename: result.filename,
          size: result.size,
        },
      ])

      toast.success('Screenshot captured')
    } catch (error) {
      console.error('Screenshot error:', error)
      toast.error('Failed to capture screenshot')
      onOpenChange(true)
    } finally {
      setIsCapturing(false)
    }
  }, [chatId, isCapturing, onOpenChange])

  /**
   * Handle file upload
   */
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      try {
        const result = await uploadFile(file, chatId || undefined)
        setPendingAttachments((prev) => [
          ...prev,
          {
            type: result.type,
            url: result.url,
            filename: result.filename,
            size: result.size,
          },
        ])
        toast.success('File uploaded')
      } catch (error) {
        console.error('Upload error:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to upload file')
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [chatId]
  )

  /**
   * Remove pending attachment
   */
  const removeAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  /**
   * Start new chat - clears current state and localStorage
   */
  const startNewChat = useCallback(() => {
    setMessages([])
    setChatId(null)
    setSessionCost(0)
    setPendingAttachments([])
    setInputValue('')
    localStorage.removeItem(CHAT_ID_STORAGE_KEY)
  }, [])

  /**
   * Submit feedback - marks chat as resolved and clears state
   */
  const submitFeedback = useCallback(async () => {
    if (!chatId || isSubmitting) return

    setIsSubmitting(true)
    try {
      // Call API to update chat status to resolved
      const response = await fetch('/api/feedback/chat/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, status: 'resolved' }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit feedback')
      }

      // Clear localStorage and reset state
      localStorage.removeItem(CHAT_ID_STORAGE_KEY)
      setMessages([])
      setChatId(null)
      setSessionCost(0)
      setPendingAttachments([])
      setInputValue('')

      toast.success('Feedback submitted! Thank you for your input.')
      onOpenChange(false)
    } catch (error) {
      console.error('[FeedbackChat] Submit error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit feedback')
    } finally {
      setIsSubmitting(false)
    }
  }, [chatId, isSubmitting, onOpenChange])

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        sendMessage()
      }
    },
    [sendMessage]
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        id="feedback-chat-panel"
        data-feedback-ignore
        className="w-full sm:max-w-lg flex flex-col p-0"
        side="right"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <SheetTitle className="text-base">FOSSAPP Assistant</SheetTitle>
              {chatId && messages.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Draft
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mr-6">
              {sessionCost > 0 && (
                <span className="text-xs text-muted-foreground">
                  {formatCostEur(sessionCost)}
                </span>
              )}
              {chatId && messages.length > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={submitFeedback}
                  disabled={isSubmitting || isLoading}
                  className="h-7 text-xs"
                  title="Submit feedback and close"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  Submit
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={startNewChat}
                title="New chat"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SheetDescription className="text-xs">
            Ask about products, report bugs, or request features
          </SheetDescription>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 px-2">
          <div className="space-y-2 py-4">
            {isLoadingHistory ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
                <p className="text-sm">Restoring conversation...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Start a conversation</p>
                <p className="text-xs mt-1">
                  Ask about products or share feedback
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  userImage={session?.user?.image}
                  userName={session?.user?.name || session?.user?.email}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Pending Attachments */}
        {pendingAttachments.length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/30">
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((attachment, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 px-2 py-1 bg-background rounded-md border text-xs"
                >
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[100px] truncate">
                    {attachment.filename}
                  </span>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t shrink-0">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="min-h-[60px] max-h-[120px] resize-none pr-20"
                disabled={isLoading}
              />
              <div className="absolute right-2 bottom-2 flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleScreenshot}
                  disabled={isLoading || isCapturing}
                  title="Take screenshot"
                >
                  {isCapturing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button
              onClick={sendMessage}
              disabled={isLoading || (!inputValue.trim() && pendingAttachments.length === 0)}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Floating action button (FAB) to open the feedback chat panel.
 *
 * @remarks
 * Typically positioned fixed at the bottom-right of the viewport.
 * Uses primary color with shadow for visibility.
 */
export function FeedbackButton({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      variant="default"
      size="icon"
      className={`h-12 w-12 rounded-full shadow-lg ${className || ''}`}
      onClick={onClick}
      title="Open feedback chat"
    >
      <MessageCircle className="h-6 w-6" />
    </Button>
  )
}
