import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface ProductSearchResult {
  product_id: string
  foss_pid: string
  description_short: string
  supplier_name: string
  prices: Array<{
    date: string
    disc1: number
    start_price: number
  }>
}

export async function searchProducts(query: string): Promise<ProductSearchResult[]> {
  try {
    const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`)

    if (!response.ok) {
      console.error('Search failed:', {
        status: response.status,
        query: query.substring(0, 50)
      })
      return []  // ✅ Return empty array instead of throwing
    }

    const result = await response.json()
    return result.data || []
  } catch (error) {
    console.error('Search error:', error instanceof Error ? error.message : 'Unknown error')
    return []  // ✅ Consistent: return empty array on error
  }
}