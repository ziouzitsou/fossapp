/**
 * Server-side Supabase Client
 *
 * Creates a Supabase client with the service_role key for full admin access.
 * This client BYPASSES Row Level Security (RLS) and has unrestricted access.
 *
 * @remarks
 * **CRITICAL SECURITY**: Only use in server-side code:
 * - API routes (`src/app/api/`)
 * - Server actions (`'use server'` functions)
 * - Server components (async components)
 *
 * NEVER import this in client components or expose to the browser.
 * For client-side database access, use `@fossapp/core/db/client` instead.
 *
 * @module @fossapp/core/db
 * @see {@link ./client.ts} for client-side (RLS-protected) access
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase server environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
}

/**
 * Server-side Supabase client instance.
 *
 * @remarks
 * Configured with:
 * - `autoRefreshToken: false` - No token refresh (stateless server)
 * - `persistSession: false` - No session storage (server-side only)
 *
 * @example
 * import { supabaseServer } from '@fossapp/core/db'
 *
 * // In a server action
 * const { data } = await supabaseServer
 *   .from('products')
 *   .select('*')
 *   .limit(10)
 */
export const supabaseServer: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
