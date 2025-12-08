/**
 * User Service
 *
 * Server-side utilities for user management.
 * Uses service_role key for admin operations.
 */

import { supabaseServer } from './supabase-server'
export { GROUP_PERMISSIONS, hasPermission, type GroupName, type Permission } from './permissions'

export interface UserRecord {
  id: string
  email: string
  name: string | null
  image: string | null
  group_id: number
  group_name: string
  is_active: boolean
  first_login_at: string | null
  last_login_at: string | null
  login_count: number
}

/**
 * Upsert user on login
 * Creates new user on first login, updates existing user on subsequent logins
 */
export async function upsertUserOnLogin(
  email: string,
  name?: string | null,
  image?: string | null
): Promise<UserRecord | null> {
  const { data, error } = await supabaseServer.schema('analytics').rpc('upsert_user_on_login', {
    p_email: email,
    p_name: name || null,
    p_image: image || null,
  })

  if (error) {
    console.error('Failed to upsert user:', error)
    return null
  }

  // RPC returns array, get first row
  return data?.[0] || null
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const { data, error } = await supabaseServer
    .schema('analytics')
    .from('users')
    .select(`
      id,
      email,
      name,
      image,
      group_id,
      is_active,
      first_login_at,
      last_login_at,
      login_count,
      user_groups!inner(name)
    `)
    .eq('email', email)
    .single()

  if (error || !data) {
    return null
  }

  // Handle the joined user_groups data
  const userGroups = data.user_groups as unknown as { name: string }
  return {
    ...data,
    group_name: userGroups.name,
  } as UserRecord
}

/**
 * Check if user is active (can login)
 */
export async function isUserActive(email: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .schema('analytics')
    .from('users')
    .select('is_active')
    .eq('email', email)
    .single()

  if (error || !data) {
    // User doesn't exist yet, will be created on login
    return true
  }

  return data.is_active
}

