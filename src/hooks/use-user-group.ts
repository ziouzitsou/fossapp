'use client'

import { useSession } from 'next-auth/react'
import { useMemo } from 'react'
import { GROUP_PERMISSIONS, type Permission, type GroupName } from '@/lib/user-service'

/**
 * Hook to access user group and check permissions
 *
 * @example
 * const { group, canAccess, isAdmin } = useUserGroup()
 * if (!canAccess('tiles')) return <AccessDenied />
 */
export function useUserGroup() {
  const { data: session, status } = useSession()

  const group = session?.user?.group as GroupName | undefined
  const groupId = session?.user?.groupId

  const permissions = useMemo(() => {
    if (!group || !(group in GROUP_PERMISSIONS)) {
      return [] as readonly Permission[]
    }
    return GROUP_PERMISSIONS[group]
  }, [group])

  const canAccess = useMemo(() => {
    return (permission: Permission): boolean => {
      if (!group) return false
      const perms = GROUP_PERMISSIONS[group as GroupName]
      if (!perms) return false
      return (perms as readonly string[]).includes(permission)
    }
  }, [group])

  return {
    group,
    groupId,
    permissions,
    canAccess,
    isAdmin: group === 'admin',
    isPowerUser: group === 'power_user' || group === 'admin',
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
  }
}
