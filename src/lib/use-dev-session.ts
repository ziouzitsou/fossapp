'use client'

import { useSession } from 'next-auth/react'
import { useMemo, useEffect } from 'react'

// Mock session for development bypass
const MOCK_SESSION = {
  user: {
    name: 'Dimitris Christou',
    email: 'development@foss.gr',
    image: '/default-avatar.png'
  },
  expires: '2099-12-31'
}

/**
 * Development-aware session hook
 * Returns mock session in dev mode when NEXT_PUBLIC_BYPASS_AUTH is enabled
 * Returns real session in production
 *
 * SECURITY: This bypass is ONLY allowed in development mode.
 * Production builds will ALWAYS use real authentication.
 */
export function useDevSession() {
  const realSession = useSession()

  const shouldBypass = useMemo(() => {
    // CRITICAL: NEVER bypass authentication in production
    if (process.env.NODE_ENV === 'production') {
      return false
    }

    return (
      process.env.NODE_ENV === 'development' &&
      process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'
    )
  }, [])

  // Log security warning if bypass is attempted in production
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' &&
        process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true') {
      console.error(
        '[SECURITY CRITICAL] NEXT_PUBLIC_BYPASS_AUTH is set to true in production! ' +
        'This is a security vulnerability. Authentication bypass has been disabled.'
      )
    }
  }, [])

  if (shouldBypass) {
    return {
      data: MOCK_SESSION,
      status: 'authenticated' as const
    }
  }

  return realSession
}
