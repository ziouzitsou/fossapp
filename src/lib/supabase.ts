import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
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

import { searchProductsAction } from './actions'

export async function searchProducts(query: string): Promise<ProductSearchResult[]> {
  try {
    // Use server action for better database connectivity
    const results = await searchProductsAction(query)
    return results
  } catch (error) {
    console.error('Search error:', error)
    
    // Fallback to API endpoint if server action fails
    try {
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      return result.data || []
    } catch (apiError) {
      console.error('API fallback error:', apiError)
      throw error
    }
  }
}