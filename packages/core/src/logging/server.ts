/**
 * Event Logger Utility
 *
 * Server-side only utility for logging user access events to Supabase.
 * Uses service role client for secure, reliable logging.
 *
 * Usage:
 *   import { logEvent } from '@fossapp/core/logging'
 *   await logEvent('login', 'user@example.com', { method: 'google' })
 */

import { supabaseServer } from '../db/server'
import type { EventType, EventData } from './types'

/**
 * Log a user event to the database
 *
 * @param eventType - Type of event being logged
 * @param userId - User identifier (email from NextAuth session)
 * @param options - Optional event metadata
 * @param options.eventData - Flexible JSONB metadata
 * @param options.sessionId - Session identifier for grouping events
 * @param options.pathname - Route/page path (e.g., /products, /dashboard)
 * @param options.userAgent - Browser and device information
 * @returns Promise<boolean> - true if logged successfully, false otherwise
 *
 * @example
 * // Log a login event
 * await logEvent('login', 'user@example.com', {
 *   eventData: { method: 'google' },
 *   pathname: '/'
 * })
 *
 * @example
 * // Log a product search
 * await logEvent('search', 'user@example.com', {
 *   eventData: { search_query: 'downlight', results_count: 42 },
 *   pathname: '/products',
 *   userAgent: req.headers['user-agent']
 * })
 */
export async function logEvent(
  eventType: EventType,
  userId: string,
  options?: {
    eventData?: EventData
    sessionId?: string
    pathname?: string
    userAgent?: string
  }
): Promise<boolean> {
  try {
    // Validate required parameters
    if (!eventType || !userId) {
      console.error('[EventLogger] Missing required parameters:', { eventType, userId })
      return false
    }

    // Insert event into analytics.user_events table
    const { error } = await supabaseServer
      .schema('analytics')
      .from('user_events')
      .insert({
        event_type: eventType,
        user_id: userId,
        event_data: options?.eventData || null,
        session_id: options?.sessionId || null,
        pathname: options?.pathname || null,
        user_agent: options?.userAgent || null,
      })

    if (error) {
      console.error('[EventLogger] Failed to log event:', error.message)
      return false
    }

    // Success - log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[EventLogger]', { eventType, userId, ...options })
    }

    return true
  } catch (error) {
    // Never let logging errors crash the application
    console.error('[EventLogger] Unexpected error:', error)
    return false
  }
}

/**
 * Logs multiple events in a single database insert for better performance.
 *
 * @remarks
 * Use this for related events that should be logged atomically,
 * or when you have multiple events to log from a single user action.
 * More efficient than multiple logEvent() calls.
 *
 * @param events - Array of event objects to log
 * @returns Promise<boolean> - true if all events logged successfully, false on any error
 *
 * @example
 * await logEventsBatch([
 *   { eventType: 'search', userId: user, eventData: { query: 'led' } },
 *   { eventType: 'search_filter_applied', userId: user, eventData: { filter: 'brand' } }
 * ])
 */
export async function logEventsBatch(
  events: Array<{
    eventType: EventType
    userId: string
    eventData?: EventData
    sessionId?: string
    pathname?: string
    userAgent?: string
  }>
): Promise<boolean> {
  try {
    if (!events || events.length === 0) {
      return false
    }

    const records = events.map(e => ({
      event_type: e.eventType,
      user_id: e.userId,
      event_data: e.eventData || null,
      session_id: e.sessionId || null,
      pathname: e.pathname || null,
      user_agent: e.userAgent || null,
    }))

    const { error } = await supabaseServer
      .schema('analytics')
      .from('user_events')
      .insert(records)

    if (error) {
      console.error('[EventLogger] Batch insert failed:', error.message)
      return false
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[EventLogger] Batch logged:', events.length, 'events')
    }

    return true
  } catch (error) {
    console.error('[EventLogger] Batch error:', error)
    return false
  }
}

/**
 * Generates a session ID for grouping related user events.
 *
 * @remarks
 * Creates a simple session identifier by combining user email with an hour timestamp.
 * This groups all events from the same user within the same hour,
 * useful for analyzing user journeys and session-based metrics.
 *
 * @param userEmail - User's email from NextAuth session
 * @returns Session ID in format "email-hourTimestamp"
 *
 * @example
 * const sessionId = generateSessionId('user@example.com')
 * // Returns: "user@example.com-486792" (hour-based timestamp)
 */
export function generateSessionId(userEmail: string): string {
  // Simple session ID: hash of email + hour (groups events by hour)
  const hourTimestamp = Math.floor(Date.now() / (1000 * 60 * 60))
  return `${userEmail}-${hourTimestamp}`
}
