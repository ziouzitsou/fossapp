/**
 * E2E Test Session API Endpoint
 *
 * Returns mock session for E2E tests when valid x-e2e-test-key header is present.
 * This endpoint is called by Playwright route interception to mock useSession().
 *
 * Security:
 * - Validates E2E secret header
 * - Returns 401 for invalid/missing header
 * - Rate limited (handled by validateE2EBypass)
 * - All attempts are logged
 */

import { NextResponse } from 'next/server'
import { validateE2EBypass, E2E_TEST_SESSION } from '@/lib/e2e-auth'

export async function GET(request: Request) {
  const result = validateE2EBypass(
    new Headers(request.headers),
    '/api/e2e-session'
  )

  if (!result.isValid) {
    // Return appropriate error
    const status = result.statusCode || 401
    const message = result.error || 'Unauthorized'

    return NextResponse.json({ error: message }, { status })
  }

  // Return session in NextAuth format
  // This matches the structure returned by /api/auth/session
  return NextResponse.json(E2E_TEST_SESSION)
}

// Also support HEAD requests (some clients check session this way)
export async function HEAD(request: Request) {
  const result = validateE2EBypass(
    new Headers(request.headers),
    '/api/e2e-session'
  )

  if (!result.isValid) {
    return new NextResponse(null, { status: result.statusCode || 401 })
  }

  return new NextResponse(null, { status: 200 })
}
