/**
 * E2E Test Authentication Bypass
 *
 * Provides secure header-based authentication bypass for Playwright E2E tests.
 * This allows running authenticated tests against production without real OAuth.
 *
 * SECURITY:
 * - 64+ character secret required (cryptographically secure)
 * - Only works when E2E_TEST_SECRET env var is set
 * - Returns limited test user (not admin)
 * - All bypass attempts are logged
 * - Rate limited to 100 requests/minute per IP
 *
 * @see docs/testing/e2e-auth-bypass.md
 */

// E2E Test Header Name
export const E2E_AUTH_HEADER = 'x-e2e-test-key'

// Minimum secret length for security
const MIN_SECRET_LENGTH = 64

/**
 * Timing-safe string comparison (Edge Runtime compatible)
 *
 * Prevents timing attacks by always comparing all characters,
 * regardless of where the first mismatch occurs. This ensures
 * the comparison takes the same time whether strings differ
 * at the first character or the last.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Always compare same number of characters to prevent length-based timing leaks
  // If lengths differ, we still iterate over the longer string's length
  // but the result will be non-zero due to XOR with 0 (missing char)
  const maxLength = Math.max(a.length, b.length)

  let result = a.length ^ b.length // Non-zero if lengths differ

  for (let i = 0; i < maxLength; i++) {
    // Use 0 for out-of-bounds to ensure we always iterate maxLength times
    const charA = i < a.length ? a.charCodeAt(i) : 0
    const charB = i < b.length ? b.charCodeAt(i) : 0
    result |= charA ^ charB
  }

  return result === 0
}

// Rate limiting: 100 requests per minute per IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 100

// In-memory rate limit store (edge-compatible)
// Note: In a multi-instance deployment, use Redis instead
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

/**
 * Mock session for E2E test user
 * This user has minimal permissions - NOT an admin
 */
export const E2E_TEST_SESSION = {
  user: {
    name: 'E2E Test User',
    email: 'e2e-test@fossapp.local',
    image: '/default-avatar.png',
    group: 'E2E Testing',
    groupId: -1, // Special ID for test group
  },
  expires: '2099-12-31T23:59:59.999Z',
}

/**
 * E2E bypass log entry for audit trail
 */
interface E2EBypassLogEntry {
  timestamp: string
  ip: string
  userAgent: string
  success: boolean
  reason?: string
  path?: string
}

/**
 * Logs E2E bypass attempts for security audit
 * In production, these should go to a persistent log store
 */
function logE2EBypassAttempt(entry: E2EBypassLogEntry): void {
  const logPrefix = entry.success
    ? '[E2E-AUTH] ✓ Bypass granted'
    : '[E2E-AUTH] ✗ Bypass denied'

  console.log(
    `${logPrefix}: IP=${entry.ip} Path=${entry.path || 'unknown'} Reason=${entry.reason || 'valid'} UA=${entry.userAgent.slice(0, 50)}...`
  )

  // TODO: In production, send to logging service (Supabase, Datadog, etc.)
  // await logEvent('e2e_bypass_attempt', 'system', { eventData: entry })
}

/**
 * Check rate limit for an IP address
 * Returns true if request is allowed, false if rate limited
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitStore.get(ip)

  // Clean up expired entries periodically (1 in 100 requests)
  if (Math.random() < 0.01) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key)
      }
    }
  }

  if (!record || record.resetAt < now) {
    // New window
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 }
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 }
  }

  record.count++
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count }
}

/**
 * Extract client IP from request headers
 * Handles various proxy configurations
 */
export function getClientIP(headers: Headers): string {
  // Check common proxy headers
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Take first IP in chain (original client)
    return forwardedFor.split(',')[0].trim()
  }

  const realIP = headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Cloudflare
  const cfIP = headers.get('cf-connecting-ip')
  if (cfIP) {
    return cfIP
  }

  return 'unknown'
}

/**
 * Validate E2E bypass request
 *
 * Checks:
 * 1. E2E_TEST_SECRET is configured
 * 2. Request has valid E2E header
 * 3. Rate limit not exceeded
 *
 * @param headers - Request headers
 * @param path - Request path (for logging)
 * @returns Object with isValid, session (if valid), and error (if invalid)
 */
export function validateE2EBypass(
  headers: Headers,
  path?: string
): {
  isValid: boolean
  session?: typeof E2E_TEST_SESSION
  error?: string
  statusCode?: number
} {
  const ip = getClientIP(headers)
  const userAgent = headers.get('user-agent') || 'unknown'
  const e2eHeader = headers.get(E2E_AUTH_HEADER)

  // Get the configured secret
  const configuredSecret = process.env.E2E_TEST_SECRET

  // 1. Check if E2E bypass is enabled
  if (!configuredSecret) {
    // E2E bypass is disabled - this is expected in most deployments
    // Don't log - would be too noisy for normal requests without the header
    if (e2eHeader) {
      logE2EBypassAttempt({
        timestamp: new Date().toISOString(),
        ip,
        userAgent,
        success: false,
        reason: 'e2e_disabled',
        path,
      })
    }
    return { isValid: false }
  }

  // 2. Validate secret length
  if (configuredSecret.length < MIN_SECRET_LENGTH) {
    console.error(
      `[E2E-AUTH] SECURITY ERROR: E2E_TEST_SECRET is too short (${configuredSecret.length} chars, minimum ${MIN_SECRET_LENGTH})`
    )
    return {
      isValid: false,
      error: 'E2E bypass misconfigured',
      statusCode: 500,
    }
  }

  // 3. Check if request has E2E header
  if (!e2eHeader) {
    // No header - not an E2E request (don't log, normal traffic)
    return { isValid: false }
  }

  // 4. Check rate limit
  const rateLimit = checkRateLimit(ip)
  if (!rateLimit.allowed) {
    logE2EBypassAttempt({
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      success: false,
      reason: 'rate_limited',
      path,
    })
    return {
      isValid: false,
      error: 'Too many requests',
      statusCode: 429,
    }
  }

  // 5. Validate the secret using timing-safe comparison
  // This prevents timing attacks where attackers measure response times
  // to guess the secret character-by-character
  if (!timingSafeEqual(e2eHeader, configuredSecret)) {
    logE2EBypassAttempt({
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      success: false,
      reason: 'invalid_secret',
      path,
    })
    // Don't reveal that the secret was wrong - just say unauthorized
    return {
      isValid: false,
      error: 'Unauthorized',
      statusCode: 401,
    }
  }

  // SUCCESS - Valid E2E bypass
  logE2EBypassAttempt({
    timestamp: new Date().toISOString(),
    ip,
    userAgent,
    success: true,
    path,
  })

  return {
    isValid: true,
    session: E2E_TEST_SESSION,
  }
}

/**
 * Server-side E2E session check
 *
 * Use this in API routes and server actions to check for E2E bypass
 * before falling back to getServerSession
 *
 * @example
 * ```ts
 * import { getE2ESession } from '@/lib/e2e-auth'
 * import { getServerSession } from 'next-auth'
 *
 * export async function GET(request: Request) {
 *   // Check E2E bypass first
 *   const e2eSession = getE2ESession(request.headers)
 *   const session = e2eSession || await getServerSession(authOptions)
 *
 *   if (!session) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 *   }
 *   // ... rest of handler
 * }
 * ```
 */
export function getE2ESession(
  headers: Headers
): typeof E2E_TEST_SESSION | null {
  const result = validateE2EBypass(headers)
  return result.isValid ? result.session! : null
}

/**
 * Check if current request is an E2E test request
 * Useful for conditional logic in middleware
 */
export function isE2ERequest(headers: Headers): boolean {
  return headers.has(E2E_AUTH_HEADER)
}
