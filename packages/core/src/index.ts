/**
 * @fossapp/core - Foundation package
 *
 * Core utilities shared across the FOSSAPP monorepo:
 * - Database clients (Supabase server & client)
 * - Event logging (server & client)
 * - Rate limiting
 * - Configuration constants
 * - Validation utilities
 */

export const CORE_VERSION = '0.0.1'

// Database clients
export { supabase } from './db/client'
export { supabaseServer } from './db/server'

// Logging utilities
export {
  logEvent,
  logEventsBatch,
  generateSessionId,
  logEventClient,
} from './logging'
export type { EventType, EventData } from './logging'

// Rate limiting
export {
  checkRateLimit,
  rateLimitHeaders,
  RATE_LIMITS,
} from './ratelimit'
export type { RateLimitEndpoint } from './ratelimit'

// Configuration constants
export {
  VALIDATION,
  PAGINATION,
  DASHBOARD,
  CACHE,
  UI,
  API,
} from './config'
export type {
  ValidationConfig,
  PaginationConfig,
  DashboardConfig,
  CacheConfig,
  UIConfig,
  APIConfig,
} from './config'

// Validation utilities
export {
  validateSearchQuery,
  validateProductId,
  validateCustomerId,
  validateProjectId,
  validateTaxonomyCode,
  validateSupplierId,
  validateUUID,
} from './validation'

// Text transformation utilities
export {
  transformText,
  titleCase,
  requiresLLM,
  anyRequiresLLM,
  LLM_TRANSFORMS,
  LOCAL_TRANSFORMS,
} from './text'
export type {
  TextTransform,
  TransformOptions,
  TransformResult,
} from './text'
