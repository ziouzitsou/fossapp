/**
 * Event Logger Utility
 *
 * Server-side only utility for logging user access events to Supabase.
 * Uses service role client for secure, reliable logging.
 *
 * Usage:
 *   import { logEvent } from '@/lib/event-logger'
 *   await logEvent('login', 'user@example.com', { method: 'google' })
 */

import { supabaseServer } from './supabase-server'

/**
 * Event types for user access monitoring
 *
 * Phase 1 (Implemented):
 * - Search & Discovery: search, search_refinement, search_no_results
 * - Product Engagement: product_view, product_image_viewed, product_details_expanded
 * - User Preferences: theme_toggled
 * - Error Tracking: client_error, api_error
 * - Performance: page_load_time, api_response_time
 *
 * See USER_ACCESS_MONITORING.md for full event catalog and future phases
 */
export type EventType =
  // Authentication
  | 'login'
  | 'login_blocked'  // Disabled user attempted login
  | 'logout'

  // Search & Discovery (Phase 1)
  | 'search'
  | 'search_refinement'        // User modifies search query
  | 'search_no_results'         // Search returned zero results
  | 'search_filter_applied'     // User applies filters
  | 'search_sort_changed'       // User changes sort order

  // Product Engagement (Phase 1)
  | 'product_view'
  | 'product_image_viewed'      // User views/zooms product image
  | 'product_details_expanded'  // User expands accordion sections
  | 'product_favorite_added'    // User adds to favorites (future)
  | 'product_favorite_removed'  // User removes from favorites (future)

  // User Preferences (Phase 1)
  | 'theme_toggled'             // User switches light/dark/system theme

  // Error Tracking (Phase 1)
  | 'client_error'              // Client-side JavaScript errors
  | 'api_error'                 // API request failures

  // Performance Metrics (Phase 1)
  | 'page_load_time'            // Page load performance
  | 'api_response_time'         // API latency tracking

  // Legacy/General
  | 'page_view'
  | 'api_call'

/**
 * Event data structure (flexible JSONB)
 */
export interface EventData {
  [key: string]: string | number | boolean | null | undefined
  // Common fields:
  // - search_query?: string
  // - product_id?: string
  // - page_path?: string
  // - referrer?: string
  // - user_agent?: string
  // - method?: string (auth method)
}

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
 *
 * @example
 * // Log a product view
 * await logEvent('product_view', 'user@example.com', {
 *   eventData: { product_id: 'DL-123456', supplier: 'Delta Light' },
 *   pathname: '/products/DL-123456'
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
 * Log multiple events in batch
 * Useful for logging related events atomically
 *
 * @param events - Array of event objects
 * @returns Promise<boolean> - true if all logged successfully
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
 * Helper function to extract session ID from NextAuth session
 * Uses a simple hash of user email + timestamp as session identifier
 *
 * @param userEmail - User's email from session
 * @returns Session ID string
 */
export function generateSessionId(userEmail: string): string {
  // Simple session ID: hash of email + hour (groups events by hour)
  const hourTimestamp = Math.floor(Date.now() / (1000 * 60 * 60))
  return `${userEmail}-${hourTimestamp}`
}

/**
 * Client-side event logger (for browser events)
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
