/**
 * Client-side Supabase Client
 *
 * Creates a Supabase client with the anon (public) key for browser use.
 * All queries are subject to Row Level Security (RLS) policies.
 *
 * @remarks
 * Safe to use in:
 * - Client components (`'use client'`)
 * - Browser-only code
 *
 * The anon key is public and can be exposed to browsers safely.
 * RLS policies on Supabase tables control what data is accessible.
 *
 * **Note**: Most FOSSAPP data access goes through server actions using
 * `supabaseServer` to benefit from caching and avoid RLS complexity.
 * Use this client sparingly for real-time features or simple public queries.
 *
 * @module @fossapp/core/db
 * @see {@link ./server.ts} for server-side (admin) access
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

/**
 * Client-side Supabase client instance.
 *
 * @remarks
 * Uses default auth configuration with session persistence for browser use.
 *
 * @example
 * import { supabase } from '@fossapp/core/db/client'
 *
 * // In a client component
 * const { data } = await supabase
 *   .from('public_products')
 *   .select('name, price')
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)
