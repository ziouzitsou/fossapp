/**
 * Client-side Event Logger
 *
 * Safe to import from client components.
 * Sends events to API endpoint which logs server-side.
 */

import type { EventType, EventData } from './types'

/**
 * Client-side event logger
 * Sends events to API endpoint which then logs server-side
 *
 * @param eventType - Type of event
 * @param eventData - Event metadata
 * @returns Promise<boolean>
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
