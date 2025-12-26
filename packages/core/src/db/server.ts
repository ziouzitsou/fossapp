import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client with service role key for admin operations
 *
 * IMPORTANT: Only use in server-side code (API routes, server actions, etc.)
 * Never expose to client-side code as it has full database access.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase server environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
}

export const supabaseServer: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
