/**
 * Centralized application constants
 *
 * Use these constants instead of magic numbers throughout the codebase.
 * This enables easy configuration changes and improves maintainability.
 */

// ============================================================================
// VALIDATION LIMITS
// ============================================================================

export const VALIDATION = {
  /** Maximum characters for search queries */
  SEARCH_QUERY_MAX_LENGTH: 100,
  /** Maximum characters for taxonomy codes */
  TAXONOMY_CODE_MAX_LENGTH: 100,
  /** Maximum characters for supplier names */
  SUPPLIER_NAME_MAX_LENGTH: 100,
  /** Maximum characters for customer names */
  CUSTOMER_NAME_MAX_LENGTH: 100,
  /** Maximum characters for error stacks in logging */
  ERROR_STACK_MAX_LENGTH: 500,
  /** UUID validation regex pattern */
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
} as const

// ============================================================================
// PAGINATION DEFAULTS
// ============================================================================

export const PAGINATION = {
  /** Default limit for product search results */
  DEFAULT_SEARCH_LIMIT: 50,
  /** Default page size for product grid display */
  DEFAULT_PRODUCT_PAGE_SIZE: 24,
  /** Default page size for customer listings */
  DEFAULT_CUSTOMER_PAGE_SIZE: 20,
  /** Default page size for project listings */
  DEFAULT_PROJECT_PAGE_SIZE: 10,
  /** Maximum results for taxonomy queries (prevents large responses) */
  TAXONOMY_QUERY_LIMIT: 100,
  /** Maximum batch size for bulk operations */
  MAX_BATCH_SIZE: 1000,
} as const

// ============================================================================
// DASHBOARD & DISPLAY LIMITS
// ============================================================================

export const DASHBOARD = {
  /** Number of top families to show on dashboard */
  TOP_FAMILIES_LIMIT: 10,
  /** Number of most active users to display */
  ACTIVE_USERS_LIMIT: 5,
  /** Number of recent customers to show */
  RECENT_CUSTOMERS_LIMIT: 10,
  /** Number of important features to highlight */
  IMPORTANT_FEATURES_LIMIT: 5,
} as const

// ============================================================================
// CACHE SETTINGS
// ============================================================================

export const CACHE = {
  /** Dashboard stats cache TTL in seconds (5 minutes) */
  DASHBOARD_STATS_TTL: 300,
  /** PWA manifest cache TTL in seconds (1 hour) */
  MANIFEST_TTL: 3600,
  /** Sidebar state cookie max age in seconds (7 days) */
  SIDEBAR_COOKIE_MAX_AGE: 60 * 60 * 24 * 7,
} as const

// ============================================================================
// UI DEFAULTS
// ============================================================================

export const UI = {
  /** Default max height for filter dropdowns */
  FILTER_MAX_HEIGHT: '12rem',
  /** Default maximum value for range sliders */
  DEFAULT_RANGE_MAX: 100,
  /** Default minimum value for range sliders */
  DEFAULT_RANGE_MIN: 0,
} as const

// ============================================================================
// API SETTINGS
// ============================================================================

export const API = {
  /** Request timeout in milliseconds (30 seconds) */
  REQUEST_TIMEOUT: 30000,
  /** Maximum retries for failed requests */
  MAX_RETRIES: 3,
  /** Rate limit: requests per minute per user */
  RATE_LIMIT_PER_MINUTE: 30,
} as const

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ValidationConfig = typeof VALIDATION
export type PaginationConfig = typeof PAGINATION
export type DashboardConfig = typeof DASHBOARD
export type CacheConfig = typeof CACHE
export type UIConfig = typeof UI
export type APIConfig = typeof API
