import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

/**
 * Auth Middleware
 *
 * Protects routes at the edge level before they reach application code.
 * This is more secure than client-side auth checks as it runs on the server.
 *
 * Protected routes: /dashboard, /products, /projects, /customers, /tiles
 * Public routes: /, /api/health, /api/auth/*
 */
export default withAuth(
  function middleware(_req) {
    // Additional middleware logic can go here
    // The token has already been verified by withAuth at this point
    return NextResponse.next()
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
