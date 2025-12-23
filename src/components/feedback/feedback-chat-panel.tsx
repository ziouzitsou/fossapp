'use client'

/**
 * Feedback Chat Panel
 *
 * Slide-out panel for AI-powered feedback chat.
 * Features: streaming responses, file uploads, screenshots, cost tracking.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Send,
  Camera,
  Paperclip,
  Loader2,
  X,
  MessageCircle,
  History,
  Plus,
} from 'lucide-react'
import { ChatMessage } from './chat-message'
import { captureAndUploadScreenshot, uploadFile } from '@/lib/feedback/screenshot'
import { formatCost } from '@/lib/feedback/pricing'
import { toast } from 'sonner'
import type { ChatUIMessage, Attachment, StreamChunk } from '@/types/feedback'

interface FeedbackChatPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackChatPanel({ open, onOpenChange }: FeedbackChatPanelProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<ChatUIMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [sessionCost, setSessionCost] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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

      // Get chat ID from header
      const responseChatId = response.headers.get('X-Chat-ID')
      if (responseChatId && !chatId) {
        setChatId(responseChatId)
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
   * Start new chat
   */
  const startNewChat = useCallback(() => {
    setMessages([])
    setChatId(null)
    setSessionCost(0)
    setPendingAttachments([])
    setInputValue('')
  }, [])

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
            </div>
            <div className="flex items-center gap-2">
              {sessionCost > 0 && (
                <span className="text-xs text-muted-foreground">
                  Session: {formatCost(sessionCost)}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
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
            {messages.length === 0 ? (
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
 * Floating action button to open feedback panel
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
