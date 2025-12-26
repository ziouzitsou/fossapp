/**
 * Event types for user access monitoring
 *
 * Phase 1 (Implemented):
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
 * Event data structure (flexible JSONB)
 */
export interface EventData {
  [key: string]: string | number | boolean | null | undefined
}
