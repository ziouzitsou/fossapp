/**
 * Client-side Event Logger
 *
 * Safe to import from client components.
 * Sends events to API endpoint which logs server-side.
 */

/**
 * Event types for user access monitoring
 */
export type EventType =
  // Authentication
  | 'login'
  | 'login_blocked'
  | 'logout'

  // Search & Discovery
  | 'search'
  | 'search_refinement'
  | 'search_no_results'
  | 'search_filter_applied'
  | 'search_sort_changed'

  // Product Engagement
  | 'product_view'
  | 'product_image_viewed'
  | 'product_details_expanded'
  | 'product_favorite_added'
  | 'product_favorite_removed'

  // User Preferences
  | 'theme_toggled'

  // Error Tracking
  | 'client_error'
  | 'api_error'

  // Performance Metrics
  | 'page_load_time'
  | 'api_response_time'

  // Legacy/General
  | 'page_view'
  | 'api_call'

/**
 * Event data structure (flexible JSONB)
 */
export interface EventData {
  [key: string]: string | number | boolean | null | undefined
}

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
