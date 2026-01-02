/**
 * Event Logging Types
 *
 * Type definitions for the FOSSAPP analytics event logging system.
 * Events are stored in the `analytics.user_events` Supabase table.
 *
 * @module @fossapp/core/logging
 * @see {@link ./server.ts} for the logEvent() function
 */

/**
 * Event types for user access monitoring.
 *
 * @remarks
 * Events are grouped by category for organization:
 * - Authentication: login, logout, login_blocked
 * - Search & Discovery: search, search_refinement, search_no_results
 * - Product Engagement: product_view, product_image_viewed, product_details_expanded
 * - User Preferences: theme_toggled
 * - Error Tracking: client_error, api_error
 * - Performance: page_load_time, api_response_time
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

  // Feedback Chat
  | 'feedback_chat'              // AI feedback chat message sent

/**
 * Event data structure for storing arbitrary event metadata.
 *
 * @remarks
 * Stored as JSONB in Supabase, allowing flexible key-value data.
 * Common fields by event type:
 * - search: { search_query, results_count, filters_applied }
 * - product_view: { product_id, product_name, manufacturer }
 * - client_error: { error_message, error_stack, component }
 * - page_load_time: { duration_ms, route }
 */
export interface EventData {
  [key: string]: string | number | boolean | null | undefined
}
