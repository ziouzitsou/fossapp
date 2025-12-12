/**
 * In-memory rate limiter for API endpoints
 *
 * Simple sliding window implementation using Map with automatic cleanup.
 * Suitable for single-instance Docker deployments.
 *
 * For multi-instance deployments, migrate to Upstash Redis:
 * @see https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory storage: Map<"userId:endpoint", RateLimitEntry>
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup interval (every 60 seconds, remove expired entries)
let cleanupInterval: NodeJS.Timeout | null = null

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
 * Rate limit configurations per endpoint
 */
export const RATE_LIMITS = {
  'products-search': { limit: 60, windowMs: 60_000 },   // 60 req/min
  'filters-facets': { limit: 30, windowMs: 60_000 },    // 30 req/min
  'analytics-log': { limit: 100, windowMs: 60_000 },    // 100 req/min
  'tiles-generate': { limit: 5, windowMs: 60_000 },     // 5 req/min (expensive operation)
  'playground-generate': { limit: 10, windowMs: 60_000 }, // 10 req/min (LLM + APS)
  'viewer-upload': { limit: 20, windowMs: 60_000 },     // 20 req/min (APS upload + translation)
  'viewer-status': { limit: 120, windowMs: 60_000 },    // 120 req/min (polling during translation)
  'symbol-generator': { limit: 20, windowMs: 60_000 },  // 20 req/min (vision LLM analysis)
} as const

export type RateLimitEndpoint = keyof typeof RATE_LIMITS

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
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
 * Create rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  }
}
