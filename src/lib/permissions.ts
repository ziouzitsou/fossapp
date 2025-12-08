/**
 * Permission definitions by group
 * Shared between client and server
 */

export const GROUP_PERMISSIONS = {
  admin: ['products', 'tiles', 'playground', 'projects', 'dashboard', 'users'],
  power_user: ['products', 'tiles', 'playground', 'projects', 'dashboard'],
  normal_user: ['products', 'projects', 'dashboard'],
  viewer: ['products'],
} as const

export type GroupName = keyof typeof GROUP_PERMISSIONS
export type Permission = (typeof GROUP_PERMISSIONS)[GroupName][number]

/**
 * Check if a group has a specific permission
 */
export function hasPermission(groupName: string, permission: Permission): boolean {
  const perms = GROUP_PERMISSIONS[groupName as GroupName]
  if (!perms) return false
  return (perms as readonly string[]).includes(permission)
}
