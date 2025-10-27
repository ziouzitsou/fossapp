'use client'

import { useSession } from 'next-auth/react'
import { useMemo } from 'react'

// Mock session for development bypass
const MOCK_SESSION = {
  user: {
    name: 'Dev User',
    email: 'dev@fossapp.local',
    image: '/default-avatar.png'
  },
  expires: '2099-12-31'
}

/**
 * Development-aware session hook
 * Returns mock session in dev mode when NEXT_PUBLIC_BYPASS_AUTH is enabled
 * Returns real session in production
 */
export function useDevSession() {
  const realSession = useSession()

  const shouldBypass = useMemo(() => {
    return (
      process.env.NODE_ENV === 'development' &&
      process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'
    )
  }, [])

  if (shouldBypass) {
    return {
      data: MOCK_SESSION,
      status: 'authenticated' as const
    }
  }

  return realSession
}
