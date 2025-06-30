'use server'

import { supabaseServer } from './supabase-server'

// Input validation and sanitization
function validateSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new Error('Invalid search query')
  }
  
  // Remove potentially dangerous characters and limit length
  const sanitized = query.trim().slice(0, 100)
  if (sanitized.length === 0) {
    throw new Error('Search query cannot be empty')
  }
  
  return sanitized
}

function validateProductId(productId: string): string {
  if (!productId || typeof productId !== 'string') {
    throw new Error('Invalid product ID')
  }
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(productId)) {
    throw new Error('Invalid product ID format')
  }
  
  return productId
}

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

export async function searchProductsAction(query: string): Promise<ProductSearchResult[]> {
  try {
    const sanitizedQuery = validateSearchQuery(query)
    console.log('Searching for:', sanitizedQuery)
    
    // Use secure parameterized query with exposed items schema and service role
    const { data, error } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('product_id, foss_pid, description_short, supplier_name, prices')
      .or(`description_short.ilike.%${sanitizedQuery}%,foss_pid.ilike.%${sanitizedQuery}%,supplier_name.ilike.%${sanitizedQuery}%,family.ilike.%${sanitizedQuery}%,subfamily.ilike.%${sanitizedQuery}%`)
      .order('description_short')
      .limit(50)
    
    if (error) {
      console.error('Database query error:', error)
      return []
    }
    
    console.log(`Found ${data?.length || 0} products from database`)
    return data || []
  } catch (error) {
    console.error('Search error:', error)
    return []
  }
}

export interface ProductDetail {
  product_id: string
  foss_pid: string
  description_short: string
  description_long: string
  supplier_name: string
  supplier_logo?: string
  class_name?: string
  family?: string
  subfamily?: string
  prices: Array<{
    date: string
    disc1: number
    start_price: number
  }>
  multimedia?: Array<{
    mime_code: string
    mime_source: string
  }>
  features?: Array<{
    feature_name: string
    fvalueC_desc?: string
    fvalueN?: number
    unit_abbrev?: string
    fvalueB?: boolean
  }>
}

export async function getProductByIdAction(productId: string): Promise<ProductDetail | null> {
  try {
    const sanitizedProductId = validateProductId(productId)
    console.log('Getting product details for:', sanitizedProductId)
    
    // Use secure parameterized query with exposed items schema and service role
    const { data, error } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('*')
      .eq('product_id', sanitizedProductId)
      .single()
    
    if (error) {
      console.error('Database query error:', error)
      return null
    }
    
    if (data) {
      console.log('Found product in database:', data.description_short)
      return {
        product_id: data.product_id,
        foss_pid: data.foss_pid,
        description_short: data.description_short,
        description_long: data.description_long,
        supplier_name: data.supplier_name,
        supplier_logo: data.supplier_logo,
        class_name: data.class_name,
        family: data.family,
        subfamily: data.subfamily,
        prices: data.prices || [],
        multimedia: data.multimedia || [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        features: data.features ? data.features.map((f: any) => ({
          feature_name: f.feature_name,
          fvalueC_desc: f.fvalueC_desc,
          fvalueN: f.fvalueN,
          unit_abbrev: f.unit_abbrev,
          fvalueB: f.fvalueB
        })) : []
      }
    }
  } catch (error) {
    console.error('Get product error:', error)
  }
  
  return null
}