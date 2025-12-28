'use client'

import ReactMarkdown from 'react-markdown'
import { cn } from '../utils'

interface MarkdownDescriptionProps {
  content: string
  className?: string
}

/**
 * Renders text content that may or may not contain markdown.
 * Plain text renders normally; markdown renders with proper formatting.
 * Uses Tailwind Typography for consistent styling in light/dark modes.
 */
export function MarkdownDescription({ content, className }: MarkdownDescriptionProps) {
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        // Customize prose for product descriptions
        'prose-p:text-muted-foreground prose-p:leading-relaxed',
        'prose-headings:text-foreground prose-headings:font-semibold',
        'prose-strong:text-foreground prose-strong:font-semibold',
        'prose-ul:text-muted-foreground prose-ol:text-muted-foreground',
        'prose-li:marker:text-muted-foreground',
        'prose-a:text-primary prose-a:no-underline prose-a:hover:underline',
        className
      )}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
