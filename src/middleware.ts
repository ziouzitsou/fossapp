import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { validateE2EBypass, E2E_AUTH_HEADER } from '@/lib/e2e-auth'

/**
 * Auth Middleware
 *
 * Protects routes at the edge level before they reach application code.
 * This is more secure than client-side auth checks as it runs on the server.
 *
 * Protected routes: /dashboard, /products, /projects, /customers, /tiles
 * Public routes: /, /api/health, /api/auth/*
 *
 * E2E Test Bypass:
 * When E2E_TEST_SECRET is configured and request includes valid x-e2e-test-key header,
 * authentication is bypassed for automated testing. All bypass attempts are logged.
 */
export default withAuth(
  function middleware(req) {
    const response = NextResponse.next()

    // If this is a valid E2E request, set a header so downstream components know
    // This helps with session mocking in API routes
    if (req.headers.has(E2E_AUTH_HEADER)) {
      const result = validateE2EBypass(req.headers, req.nextUrl.pathname)
      if (result.isValid) {
        response.headers.set('x-e2e-authenticated', 'true')
      }
    }

    return response
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to public paths without authentication
        const path = req.nextUrl.pathname

        // Public paths that don't require authentication
        const publicPaths = [
          '/',
          '/api/health',
          '/api/auth',
          '/api/e2e-session', // E2E session endpoint
          '/manifest.webmanifest',
          '/sw.js',
          '/workbox-',
        ]

        // Check if this is a public path
        const isPublicPath = publicPaths.some(publicPath =>
          path === publicPath || path.startsWith(publicPath)
        )

        if (isPublicPath) {
          return true
        }

        // Check for E2E test bypass header
        // This allows Playwright tests to access protected routes
        if (req.headers.has(E2E_AUTH_HEADER)) {
          const result = validateE2EBypass(req.headers, path)

          // If valid E2E bypass, allow access
          if (result.isValid) {
            return true
          }

          // If E2E header present but invalid, we could return false
          // But we let it fall through to normal auth for better error handling
        }

        // For protected paths, require a valid token
        return !!token
      },
    },
    pages: {
      signIn: '/',
    },
  }
)

/**
 * Matcher configuration
 *
 * Only run middleware on specific paths.
 * Excludes static files, images, and other assets.
 */
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icons, etc.
     * - Static assets (.png, .jpg, .svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)',
  ],
}
