/**
 * @fossapp/core - Foundation package
 *
 * Core utilities shared across the FOSSAPP monorepo:
 * - Database clients (Supabase server & client)
 * - Event logging (server & client)
 * - Rate limiting
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
