'use server'

import { supabaseServer } from './supabase-server'
import { ProductInfo } from '@/types/product'

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

    return data || []
  } catch (error) {
    console.error('Search error:', error)
    return []
  }
}

// Keep this for backward compatibility but it's deprecated
export interface ProductDetail {
  product_id: string
  foss_pid: string
  description_short: string
  description_long: string
  supplier_name: string
  supplier_logo?: string
  supplier_logo_dark?: string
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

export async function getProductByIdAction(productId: string): Promise<ProductInfo | null> {
  try {
    const sanitizedProductId = validateProductId(productId)

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
      // Return complete ProductInfo with all ETIM fields
      return data as ProductInfo
    }
  } catch (error) {
    console.error('Get product error:', error)
  }

  return null
}

// Dashboard statistics actions
export interface DashboardStats {
  totalProducts: number
  totalSuppliers: number
  totalFamilies: number
}

export async function getDashboardStatsAction(): Promise<DashboardStats> {
  try {
    // Get total products count
    const { count: productsCount, error: productsError } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('*', { count: 'exact', head: true })

    if (productsError) {
      console.error('Error getting products count:', productsError)
    }

    // Get unique suppliers count
    const { data: suppliersData, error: suppliersError } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('supplier_name')
      .not('supplier_name', 'is', null)

    if (suppliersError) {
      console.error('Error getting suppliers:', suppliersError)
    }

    const uniqueSuppliers = new Set(suppliersData?.map(s => s.supplier_name) || [])

    // Get unique families count
    const { data: familiesData, error: familiesError } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('family')
      .not('family', 'is', null)

    if (familiesError) {
      console.error('Error getting families:', familiesError)
    }

    const uniqueFamilies = new Set(familiesData?.map(f => f.family) || [])

    return {
      totalProducts: productsCount || 0,
      totalSuppliers: uniqueSuppliers.size,
      totalFamilies: uniqueFamilies.size
    }
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return {
      totalProducts: 0,
      totalSuppliers: 0,
      totalFamilies: 0
    }
  }
}

export interface SupplierStats {
  supplier_name: string
  product_count: number
  supplier_logo?: string
  supplier_logo_dark?: string
}

export async function getSupplierStatsAction(): Promise<SupplierStats[]> {
  try {
    // Get all products with supplier info
    const { data, error } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('supplier_name, supplier_logo, supplier_logo_dark')
      .not('supplier_name', 'is', null)

    if (error) {
      console.error('Error getting supplier stats:', error)
      return []
    }

    // Group by supplier and count products
    const supplierMap = new Map<string, SupplierStats>()

    data?.forEach((item) => {
      const existing = supplierMap.get(item.supplier_name)
      if (existing) {
        existing.product_count++
      } else {
        supplierMap.set(item.supplier_name, {
          supplier_name: item.supplier_name,
          product_count: 1,
          supplier_logo: item.supplier_logo || undefined,
          supplier_logo_dark: item.supplier_logo_dark || undefined
        })
      }
    })

    // Convert to array and sort by product count descending
    return Array.from(supplierMap.values())
      .sort((a, b) => b.product_count - a.product_count)
  } catch (error) {
    console.error('Supplier stats error:', error)
    return []
  }
}

export interface FamilyStats {
  family: string
  product_count: number
}

export async function getTopFamiliesAction(limit: number = 10): Promise<FamilyStats[]> {
  try {
    const { data, error } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('family')
      .not('family', 'is', null)

    if (error) {
      console.error('Error getting families:', error)
      return []
    }

    // Group by family and count
    const familyMap = new Map<string, number>()

    data?.forEach((item) => {
      const count = familyMap.get(item.family) || 0
      familyMap.set(item.family, count + 1)
    })

    // Convert to array and sort
    return Array.from(familyMap.entries())
      .map(([family, product_count]) => ({ family, product_count }))
      .sort((a, b) => b.product_count - a.product_count)
      .slice(0, limit)
  } catch (error) {
    console.error('Families error:', error)
    return []
  }
}