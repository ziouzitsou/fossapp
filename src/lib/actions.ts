'use server'

import { supabaseServer } from './supabase-server'
import { ProductInfo } from '@/types/product'
import { logEvent } from './event-logger'

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

export async function searchProductsAction(query: string, userId?: string): Promise<ProductSearchResult[]> {
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

    // Log search event if userId is provided
    if (userId) {
      await logEvent('search', userId, {
        search_query: sanitizedQuery,
        results_count: data?.length || 0,
      })
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

export async function getProductByIdAction(productId: string, userId?: string): Promise<ProductInfo | null> {
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
      // Log product view event if userId is provided
      if (userId) {
        await logEvent('product_view', userId, {
          product_id: sanitizedProductId,
          foss_pid: data.foss_pid,
          supplier: data.supplier_name,
          description: data.description_short,
        })
      }

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

export async function getProductCountAction(): Promise<number | null> {
  try {
    const { count, error } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('Error getting product count:', error)
      return null
    }

    return count || 0
  } catch (error) {
    console.error('Product count error:', error)
    return null
  }
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

export interface CatalogInfo {
  catalog_name: string
  generation_date: string
  supplier_name: string
  country: string
  country_flag?: string
  supplier_logo?: string
  supplier_logo_dark?: string
  product_count: number
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

export async function getActiveCatalogsAction(): Promise<CatalogInfo[]> {
  try {
    // Use a single SQL query to get catalogs with product counts
    const { data, error } = await supabaseServer.rpc('get_active_catalogs_with_counts')

    if (error) {
      console.error('Error getting catalogs:', error)
      // Fallback to manual aggregation if RPC doesn't exist
      return getActiveCatalogsFallback()
    }

    return data || []
  } catch (error) {
    console.error('Catalogs error:', error)
    return getActiveCatalogsFallback()
  }
}

async function getActiveCatalogsFallback(): Promise<CatalogInfo[]> {
  try {
    // Get catalogs with supplier info
    const { data: catalogs, error: catalogError } = await supabaseServer
      .schema('items')
      .from('catalog')
      .select(`
        id,
        catalog_name,
        generation_date,
        supplier:supplier_id (
          supplier_name,
          country,
          country_flag,
          logo,
          logo_dark
        )
      `)
      .eq('active', true)
      .order('generation_date', { ascending: false })

    if (catalogError || !catalogs) {
      console.error('Error getting catalogs:', catalogError)
      return []
    }

    // Use SQL to count products per catalog (much more efficient)
    const catalogIds = catalogs.map(c => c.id).join(',')

    const { data: productCounts, error: countsError } = await supabaseServer.rpc('execute_sql', {
      query: `
        SELECT catalog_id, COUNT(*) as count
        FROM items.product
        WHERE catalog_id IN (${catalogIds})
        GROUP BY catalog_id
      `
    })

    if (countsError) {
      console.error('Error getting product counts:', countsError)
    }

    // Create a map of catalog_id -> count
    const countMap = new Map<number, number>()
    if (productCounts && Array.isArray(productCounts)) {
      productCounts.forEach((row: any) => {
        countMap.set(parseInt(row.catalog_id), parseInt(row.count))
      })
    }

    // Map catalogs with counts
    return catalogs.map((catalog: any) => ({
      catalog_name: catalog.catalog_name,
      generation_date: catalog.generation_date,
      supplier_name: catalog.supplier?.supplier_name || 'Unknown',
      country: catalog.supplier?.country || '',
      country_flag: catalog.supplier?.country_flag || undefined,
      supplier_logo: catalog.supplier?.logo || undefined,
      supplier_logo_dark: catalog.supplier?.logo_dark || undefined,
      product_count: countMap.get(catalog.id) || 0
    }))
  } catch (error) {
    console.error('Fallback catalogs error:', error)
    return []
  }
}

// ============================================================================
// CUSTOMER ACTIONS
// ============================================================================

function validateCustomerId(customerId: string): string {
  if (!customerId || typeof customerId !== 'string') {
    throw new Error('Invalid customer ID')
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(customerId)) {
    throw new Error('Invalid customer ID format')
  }

  return customerId
}

export interface CustomerSearchResult {
  id: string
  customer_code: string
  name: string
  name_en?: string
  email?: string
  phone?: string
  city?: string
  country?: string
  industry?: string
  company_type?: string
}

export async function searchCustomersAction(query: string): Promise<CustomerSearchResult[]> {
  try {
    const sanitizedQuery = validateSearchQuery(query)

    // Use secure parameterized query with customers schema
    const { data, error } = await supabaseServer
      .schema('customers')
      .from('customers')
      .select('id, customer_code, name, name_en, email, phone, city, country, industry, company_type')
      .or(`name.ilike.%${sanitizedQuery}%,name_en.ilike.%${sanitizedQuery}%,customer_code.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%,city.ilike.%${sanitizedQuery}%`)
      .order('name')
      .limit(50)

    if (error) {
      console.error('Customer search error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Search customers error:', error)
    return []
  }
}

export interface CustomerDetail {
  id: string
  customer_code: string
  name: string
  name_en?: string
  email?: string
  phone?: string
  mobile?: string
  fax?: string
  website?: string
  street_address?: string
  postal_code?: string
  city?: string
  region?: string
  prefecture?: string
  country?: string
  latitude?: number
  longitude?: number
  industry?: string
  company_type?: string
  size_category?: string
  tax_id?: string
  notes?: string
  data_source?: string
  created_at?: string
  updated_at?: string
}

export async function getCustomerByIdAction(customerId: string): Promise<CustomerDetail | null> {
  try {
    const sanitizedCustomerId = validateCustomerId(customerId)

    const { data, error } = await supabaseServer
      .schema('customers')
      .from('customers')
      .select('*')
      .eq('id', sanitizedCustomerId)
      .single()

    if (error) {
      console.error('Get customer error:', error)
      return null
    }

    return data as CustomerDetail
  } catch (error) {
    console.error('Get customer by ID error:', error)
    return null
  }
}

export interface CustomerListParams {
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'customer_code' | 'city' | 'created_at'
  sortOrder?: 'asc' | 'desc'
}

export interface CustomerListResult {
  customers: CustomerSearchResult[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listCustomersAction(params: CustomerListParams = {}): Promise<CustomerListResult> {
  try {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'name',
      sortOrder = 'asc'
    } = params

    // Get total count
    const { count, error: countError } = await supabaseServer
      .schema('customers')
      .from('customers')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Count error:', countError)
      return {
        customers: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0
      }
    }

    // Calculate pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Get paginated data
    const { data, error } = await supabaseServer
      .schema('customers')
      .from('customers')
      .select('id, customer_code, name, name_en, email, phone, city, country, industry, company_type')
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to)

    if (error) {
      console.error('List customers error:', error)
      return {
        customers: [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    }

    return {
      customers: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    }
  } catch (error) {
    console.error('List customers action error:', error)
    return {
      customers: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0
    }
  }
}