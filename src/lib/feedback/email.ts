/**
 * Feedback Email Notifications
 *
 * Sends email notifications to the development team when users submit feedback.
 * Uses Resend for email delivery with a verified domain.
 *
 * @remarks
 * - Domain: feedback.fossapp.online (verified in Resend)
 * - Recipient: Configured via FEEDBACK_NOTIFICATION_EMAIL env var
 * - Includes full conversation history in HTML and plain text
 * - Reports AI token costs for budget tracking
 *
 * @module feedback/email
 * @see {@link https://resend.com/docs} Resend Documentation
 */

import { Resend } from 'resend'

// Lazy initialization to avoid build-time errors when env vars not set
let resend: Resend | null = null

/**
 * Get or create the Resend client
 * @throws Error if RESEND_API_KEY is not configured
 */
function getResendClient(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

const FROM_EMAIL = 'FOSSAPP Feedback <noreply@feedback.fossapp.online>'

/**
 * A single message in a feedback conversation
 */
export interface FeedbackMessage {
  /** Message sender ('user' or 'assistant') */
  role: 'user' | 'assistant'
  /** Message text content */
  content: string
  /** ISO timestamp when message was created */
  created_at: string
}

/**
 * Data required to send a feedback notification email
 */
export interface FeedbackEmailData {
  /** UUID of the feedback chat session */
  chatId: string
  /** Email address of the user who submitted feedback */
  userEmail: string
  /** User-provided subject (optional) */
  subject: string | null
  /** Full conversation history */
  messages: FeedbackMessage[]
  /** Total AI cost in USD for this conversation */
  totalCost: number
  /** Number of messages in conversation */
  messageCount: number
}

/**
 * Format messages into readable HTML
 */
function formatMessagesHtml(messages: FeedbackMessage[]): string {
  return messages
    .map((m) => {
      const isUser = m.role === 'user'
      const bgColor = isUser ? '#e3f2fd' : '#f5f5f5'
      const label = isUser ? '👤 User' : '🤖 Assistant'
      const time = new Date(m.created_at).toLocaleString('el-GR', {
        timeZone: 'Europe/Athens',
      })

      return `
        <div style="margin-bottom: 16px; padding: 12px; background: ${bgColor}; border-radius: 8px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #333;">
            ${label} <span style="font-weight: normal; color: #666; font-size: 12px;">${time}</span>
          </div>
          <div style="white-space: pre-wrap; color: #333;">${escapeHtml(m.content)}</div>
        </div>
      `
    })
    .join('')
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Send a feedback notification email to the development team
 *
 * @remarks
 * Sends both HTML and plain text versions for compatibility.
 * HTML includes styled conversation bubbles with timestamps (Athens timezone).
 * Errors are caught and returned, not thrown.
 *
 * @param data - Email content and metadata
 * @returns Success status and optional error message
 *
 * @example
 * ```typescript
 * const result = await sendFeedbackNotification({
 *   chatId: 'abc-123',
 *   userEmail: 'user@example.com',
 *   subject: 'Bug report',
 *   messages: [...],
 *   totalCost: 0.0042,
 *   messageCount: 5
 * })
 * if (!result.success) {
 *   console.error('Email failed:', result.error)
 * }
 * ```
 */
export async function sendFeedbackNotification(
  data: FeedbackEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate subject line
    const emailSubject = data.subject
      ? `[FOSSAPP Feedback] ${data.subject}`
      : `[FOSSAPP Feedback] New feedback from ${data.userEmail}`

    // Build HTML email
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">📬 New Feedback Submitted</h1>
          </div>

          <div style="border: 1px solid #e0e0e0; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>From:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(data.userEmail)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Subject:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(data.subject || 'No subject')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Messages:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${data.messageCount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>AI Cost:</strong></td>
                <td style="padding: 8px 0;">€${data.totalCost.toFixed(4)}</td>
              </tr>
            </table>

            <h2 style="font-size: 16px; border-bottom: 2px solid #1a1a2e; padding-bottom: 8px;">Conversation</h2>

            ${formatMessagesHtml(data.messages)}

            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
              <p>Chat ID: <code>${data.chatId}</code></p>
              <p>
                <a href="https://main.fossapp.online" style="color: #1a73e8;">Open FOSSAPP</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `

    // Plain text fallback
    const text = `
New Feedback Submitted

From: ${data.userEmail}
Subject: ${data.subject || 'No subject'}
Messages: ${data.messageCount}
AI Cost: €${data.totalCost.toFixed(4)}

--- Conversation ---

${data.messages.map((m) => `[${m.role.toUpperCase()}] ${m.content}`).join('\n\n')}

---
Chat ID: ${data.chatId}
    `.trim()

    const notificationEmail = process.env.FEEDBACK_NOTIFICATION_EMAIL || 'development@foss.gr'
    const { error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: notificationEmail,
      subject: emailSubject,
      html,
      text,
    })

    if (error) {
      console.error('[Feedback Email] Error sending:', error)
      return { success: false, error: error.message }
    }

    console.log(`[Feedback Email] Sent notification for chat ${data.chatId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Feedback Email] Exception:', message)
    return { success: false, error: message }
  }
}
