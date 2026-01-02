/**
 * Client-side Event Logger
 *
 * Safe to import from React components running in the browser.
 * Events are sent to `/api/analytics/log-event` which handles
 * server-side logging with authentication context.
 *
 * @module @fossapp/core/logging
 * @see {@link ./server.ts} for server-side logging
 */

import type { EventType, EventData } from './types'

/**
 * Logs an event from a client-side component.
 *
 * @remarks
 * Use this in React components where you can't use server actions directly.
 * The API endpoint extracts user info from the session automatically.
 * Fails silently (returns false) to prevent UI disruption.
 *
 * @param eventType - Type of event from EventType union
 * @param eventData - Optional event metadata (stored as JSONB)
 * @returns Promise<boolean> - true if logged successfully, false on any error
 *
 * @example
 * // Log a theme toggle in a client component
 * await logEventClient('theme_toggled', { theme: 'dark' })
 *
 * @example
 * // Log a product view
 * await logEventClient('product_view', { product_id: '123', product_name: 'LED Panel' })
 */
export async function logEventClient(
  eventType: EventType,
  eventData?: EventData
): Promise<boolean> {
  try {
    const response = await fetch('/api/analytics/log-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, eventData }),
    })
    return response.ok
  } catch (error) {
    console.error('[EventLogger Client] Failed to log event:', error)
    return false
  }
}
