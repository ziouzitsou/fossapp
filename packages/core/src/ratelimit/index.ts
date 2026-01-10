/**
 * In-memory Rate Limiter for API Endpoints
 *
 * Simple sliding window implementation using Map with automatic cleanup.
 * Suitable for FOSSAPP's single-instance Docker deployment.
 *
 * @remarks
 * - Uses fixed window algorithm (simpler than sliding window)
 * - Automatic cleanup runs every 60 seconds to prevent memory leaks
 * - Each endpoint has its own configurable limit in RATE_LIMITS
 * - For multi-instance deployments, would need Redis (e.g., Upstash)
 *
 * @module @fossapp/core/ratelimit
 * @see {@link https://upstash.com/docs/redis/sdks/ratelimit-ts/overview} for Redis alternative
 */

/**
 * Internal rate limit entry stored in the Map.
 */
interface RateLimitEntry {
  count: number
  resetAt: number
}

/** In-memory storage: Map<"userId:endpoint", RateLimitEntry> */
const rateLimitStore = new Map<string, RateLimitEntry>()

/** Cleanup interval handle for stopping during tests */
let cleanupInterval: NodeJS.Timeout | null = null

/**
 * Starts the background cleanup timer to remove expired entries.
 *
 * @remarks
 * Called automatically on module load. Uses unref() so it doesn't
 * prevent Node.js process from exiting gracefully.
 */
function startCleanup() {
  if (cleanupInterval) return

  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key)
      }
    }
  }, 60_000)

  // Don't prevent process exit
  cleanupInterval.unref()
}

// Start cleanup on module load
startCleanup()

/**
 * Rate limit configurations per API endpoint.
 *
 * @remarks
 * Limits are tuned based on expected usage patterns:
 * - High limits for search/read operations (60-120 req/min)
 * - Lower limits for expensive operations like DWG generation (5-10 req/min)
 * - Very low limits for LLM-powered features to control costs
 *
 * To add a new endpoint, add it here and use the key in checkRateLimit().
 */
export const RATE_LIMITS = {
  'products-search': { limit: 60, windowMs: 60_000 },   // 60 req/min
  'filters-facets': { limit: 30, windowMs: 60_000 },    // 30 req/min
  'analytics-log': { limit: 100, windowMs: 60_000 },    // 100 req/min
  'tiles-generate': { limit: 5, windowMs: 60_000 },     // 5 req/min (expensive operation)
  'playground-generate': { limit: 10, windowMs: 60_000 }, // 10 req/min (LLM + APS)
  'viewer-upload': { limit: 20, windowMs: 60_000 },     // 20 req/min (APS upload + translation)
  'viewer-status': { limit: 120, windowMs: 60_000 },    // 120 req/min (polling during translation)
  'planner-upload': { limit: 20, windowMs: 60_000 },    // 20 req/min (APS persistent upload)
  'planner-status': { limit: 120, windowMs: 60_000 },   // 120 req/min (polling during translation)
  'symbol-generator': { limit: 20, windowMs: 60_000 },  // 20 req/min (vision LLM analysis)
  'symbol-generator-dwg': { limit: 10, windowMs: 60_000 }, // 10 req/min (LLM + APS generation)
  'feedback-chat': { limit: 30, windowMs: 60_000 },       // 30 req/min (AI feedback chat)
  'feedback-upload': { limit: 20, windowMs: 60_000 },     // 20 req/min (file uploads)
  'case-study-generate': { limit: 3, windowMs: 60_000 },  // 3 req/min (expensive XREF generation)
} as const

/** Type-safe endpoint names extracted from RATE_LIMITS keys */
export type RateLimitEndpoint = keyof typeof RATE_LIMITS

/**
 * Result returned from checkRateLimit().
 *
 * @remarks
 * Use `success` to determine if request should proceed.
 * Other fields are useful for building rate limit headers.
 */
interface RateLimitResult {
  /** Whether the request is allowed (under limit) */
  success: boolean
  /** Maximum requests allowed in the window */
  limit: number
  /** Requests remaining in current window */
  remaining: number
  /** Unix timestamp (ms) when the window resets */
  resetAt: number
}

/**
 * Check rate limit for a user on a specific endpoint
 *
 * @param userId - User identifier (email)
 * @param endpoint - Endpoint name from RATE_LIMITS
 * @returns Result with success status and limit info
 *
 * @example
 * const result = checkRateLimit(session.user.email, 'products-search')
 * if (!result.success) {
 *   return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
 * }
 */
export function checkRateLimit(userId: string, endpoint: RateLimitEndpoint): RateLimitResult {
  const config = RATE_LIMITS[endpoint]
  const key = `${userId}:${endpoint}`
  const now = Date.now()

  const entry = rateLimitStore.get(key)

  // No existing entry or window expired - start fresh
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetAt,
    }
  }

  // Within window - check limit
  if (entry.count >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  // Increment counter
  entry.count++
  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Creates standard rate limit headers for HTTP responses.
 *
 * @remarks
 * Follows the draft IETF rate limit headers specification.
 * Include these headers in all API responses for client-side rate limit awareness.
 *
 * @param result - The rate limit check result
 * @returns Object with X-RateLimit-* headers ready to spread into response
 *
 * @example
 * const result = checkRateLimit(userId, 'products-search')
 * return NextResponse.json(data, {
 *   headers: rateLimitHeaders(result)
 * })
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  }
}
