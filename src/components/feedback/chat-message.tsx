'use client'

/**
 * Chat Message Component
 *
 * Displays a single message in the feedback chat with avatar and metadata.
 */

import { memo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Paperclip, FileText, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCost, formatTokens } from '@/lib/feedback/pricing'
import ReactMarkdown from 'react-markdown'
import type { ChatUIMessage, Attachment } from '@/types/feedback'

interface ChatMessageProps {
  message: ChatUIMessage
  userImage?: string | null
  userName?: string | null
}

/**
 * Get user initials from name or email
 */
function getInitials(name?: string | null): string {
  if (!name) return 'U'
  const parts = name.split(/[@\s]/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

/**
 * Format timestamp for display
 */
function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Attachment preview component
 */
function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const Icon = attachment.type === 'pdf' ? FileText : ImageIcon

  if (attachment.type === 'image' || attachment.type === 'screenshot') {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-[200px] rounded-md overflow-hidden border hover:opacity-90 transition-opacity"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.filename}
          className="w-full h-auto"
        />
      </a>
    )
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 rounded-md border bg-muted/50 hover:bg-muted transition-colors max-w-[200px]"
    >
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm truncate">{attachment.filename}</span>
    </a>
  )
}

/**
 * Chat Message Component
 */
function ChatMessageComponent({ message, userImage, userName }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isStreaming = message.isStreaming

  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg',
        isUser ? 'bg-muted/30' : 'bg-background'
      )}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        {isUser ? (
          <>
            <AvatarImage src={userImage || undefined} alt={userName || 'User'} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(userName)}
            </AvatarFallback>
          </>
        ) : (
          <>
            <AvatarImage src="/anthropic-logo.png" alt="Claude" />
            <AvatarFallback className="bg-[#D4A27F] text-white text-xs font-semibold">
              AI
            </AvatarFallback>
          </>
        )}
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">
            {isUser ? (userName?.split('@')[0] || 'You') : 'FOSSAPP Assistant'}
          </span>
          <span className="text-muted-foreground text-xs">
            {formatTime(message.created_at)}
          </span>
          {isStreaming && (
            <span className="text-xs text-muted-foreground animate-pulse">
              typing...
            </span>
          )}
        </div>

        {/* Message content */}
        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
          <ReactMarkdown
            components={{
              // Render links safely
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {children}
                </a>
              ),
              // Style code blocks
              code: ({ className, children }) => {
                const isInline = !className
                return isInline ? (
                  <code className="bg-muted px-1 py-0.5 rounded text-sm">
                    {children}
                  </code>
                ) : (
                  <code className={className}>{children}</code>
                )
              },
            }}
          >
            {message.content || (isStreaming ? '...' : '')}
          </ReactMarkdown>
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {message.attachments.map((attachment, index) => (
              <AttachmentPreview key={index} attachment={attachment} />
            ))}
          </div>
        )}

        {/* Usage info (for assistant messages) */}
        {!isUser && !isStreaming && message.input_tokens && message.output_tokens && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <span>
              {formatTokens(message.input_tokens)} in / {formatTokens(message.output_tokens)} out
            </span>
            {message.cost !== undefined && (
              <>
                <span>•</span>
                <span>{formatCost(message.cost)}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Memoize to prevent unnecessary re-renders
export const ChatMessage = memo(ChatMessageComponent)
