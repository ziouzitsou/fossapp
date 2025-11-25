'use server'

import { supabaseServer } from './supabase-server'
import { ProductInfo } from '@/types/product'
import { logEvent } from './event-logger'
import { TaxonomyCategory } from './real-taxonomy-data'

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
      // Log sanitized error (no full error object that may contain tokens/connection strings)
      console.error('Product search failed:', {
        message: error.message,
        code: error.code,
        query: sanitizedQuery.substring(0, 50), // Truncate for privacy
        userId: userId?.split('@')[0], // Log only username part
      })
      return []
    }

    // Log search event if userId is provided
    if (userId) {
      const resultsCount = data?.length || 0

      // Log regular search event
      await logEvent('search', userId, {
        eventData: {
          search_query: sanitizedQuery,
          results_count: resultsCount,
        },
        pathname: '/products'
      })

      // Log no-results event separately for easier analytics
      if (resultsCount === 0) {
        await logEvent('search_no_results', userId, {
          eventData: {
            search_query: sanitizedQuery,
          },
          pathname: '/products'
        })
      }
    }

    return data || []
  } catch (error) {
    // Generic error without exposing internals
    console.error('Search action error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
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
      // Log sanitized error
      console.error('Product fetch failed:', {
        message: error.message,
        code: error.code,
        productId: sanitizedProductId.substring(0, 8) + '...', // Partial ID for privacy
        userId: userId?.split('@')[0], // Log only username part
      })
      return null
    }

    if (data) {
      // Log product view event if userId is provided
      if (userId) {
        await logEvent('product_view', userId, {
          eventData: {
            product_id: sanitizedProductId,
            foss_pid: data.foss_pid,
            supplier: data.supplier_name,
            description: data.description_short,
          },
          pathname: `/products/${sanitizedProductId}`
        })
      }

      // Return complete ProductInfo with all ETIM fields
      return data as ProductInfo
    }
  } catch (error) {
    // Generic error without exposing internals
    console.error('Get product action error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
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
    // Use items schema function (domain-driven organization)
    const { data, error } = await supabaseServer
      .schema('items')
      .rpc('get_active_catalogs_with_counts')

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

    // Count products per catalog using safe parameterized query
    // Extract catalog IDs (validated as numbers from database)
    const catalogIds = catalogs.map(c => c.id).filter(id => Number.isInteger(id))

    // Use Supabase query builder with .in() for safe parameterization
    // This approach avoids SQL injection by using parameterized queries
    const { data: products, error: countsError } = await supabaseServer
      .schema('items')
      .from('product')
      .select('catalog_id')
      .in('catalog_id', catalogIds)

    if (countsError) {
      console.error('Error getting product counts:', countsError)
    }

    // Create a map of catalog_id -> count by aggregating results
    const countMap = new Map<number, number>()
    if (products && Array.isArray(products)) {
      products.forEach((product: any) => {
        const catalogId = product.catalog_id
        countMap.set(catalogId, (countMap.get(catalogId) || 0) + 1)
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

// Analytics Actions

export interface ActiveUser {
  user_id: string
  event_count: number
  last_active: string
  login_count: number
  search_count: number
  product_view_count: number
}

export async function getMostActiveUsersAction(limit: number = 5): Promise<ActiveUser[]> {
  try {
    // Use analytics schema function (domain-driven organization)
    const { data, error } = await supabaseServer
      .schema('analytics')
      .rpc('get_most_active_users', { user_limit: limit })

    if (error) {
      console.error('Error getting active users:', error)
      return []
    }

    // Convert bigint to number for the interface
    return (data || []).map((user: any) => ({
      user_id: user.user_id,
      event_count: Number(user.event_count),
      last_active: user.last_active,
      login_count: Number(user.login_count),
      search_count: Number(user.search_count),
      product_view_count: Number(user.product_view_count),
    }))
  } catch (error) {
    console.error('Most active users error:', error)
    return []
  }
}

// ============================================================================
// PROJECT ACTIONS
// ============================================================================

function validateProjectId(projectId: string): string {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('Invalid project ID')
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(projectId)) {
    throw new Error('Invalid project ID format')
  }

  return projectId
}

export interface ProjectListItem {
  id: string
  project_code: string
  name: string
  name_en?: string
  customer_name?: string
  customer_name_en?: string
  city?: string
  project_type?: string
  status: string
  priority: string
  estimated_budget?: number
  currency?: string
  start_date?: string
  expected_completion_date?: string
  created_at: string
}

export interface ProjectProduct {
  id: string
  product_id: string
  foss_pid: string
  description_short: string
  quantity: number
  unit_price?: number
  discount_percent?: number
  total_price?: number
  room_location?: string
  mounting_height?: number
  status: string
  notes?: string
}

export interface ProjectContact {
  id: string
  contact_type: string
  name: string
  company?: string
  email?: string
  phone?: string
  mobile?: string
  role?: string
  is_primary: boolean
  notes?: string
}

export interface ProjectDocument {
  id: string
  document_type: string
  title: string
  description?: string
  file_path?: string
  file_url?: string
  mime_type?: string
  file_size_bytes?: number
  version: string
  is_latest: boolean
  created_at: string
  created_by?: string
}

export interface ProjectPhase {
  id: string
  phase_number: number
  phase_name: string
  description?: string
  budget?: number
  status: string
  start_date?: string
  end_date?: string
}

export interface ProjectDetail {
  id: string
  project_code: string
  name: string
  name_en?: string
  description?: string
  customer_id?: string
  customer_name?: string
  customer_name_en?: string
  customer_email?: string
  customer_phone?: string
  street_address?: string
  postal_code?: string
  city?: string
  region?: string
  prefecture?: string
  country?: string
  latitude?: number
  longitude?: number
  project_type?: string
  project_category?: string
  building_area_sqm?: number
  estimated_budget?: number
  currency?: string
  status: string
  priority: string
  start_date?: string
  expected_completion_date?: string
  actual_completion_date?: string
  project_manager?: string
  architect_firm?: string
  electrical_engineer?: string
  lighting_designer?: string
  notes?: string
  tags?: string[]
  created_at: string
  updated_at: string
  created_by?: string
  products: ProjectProduct[]
  contacts: ProjectContact[]
  documents: ProjectDocument[]
  phases: ProjectPhase[]
}

export interface ProjectListParams {
  page?: number
  pageSize?: number
  sortBy?: 'created_at' | 'project_code' | 'name' | 'status'
  sortOrder?: 'asc' | 'desc'
}

export interface ProjectListResult {
  projects: ProjectListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listProjectsAction(params: ProjectListParams = {}): Promise<ProjectListResult> {
  const {
    page = 1,
    pageSize = 10,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = params


  try {
    // Get total count
    const { count, error: countError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Count error:', countError)
      return {
        projects: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0
      }
    }

    // Calculate pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Fetch projects with pagination
    const { data: projects, error: projectsError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select(`
        id,
        project_code,
        name,
        name_en,
        city,
        project_type,
        status,
        priority,
        estimated_budget,
        currency,
        start_date,
        expected_completion_date,
        created_at,
        customer_id
      `)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to)

    if (projectsError) {
      console.error('List projects error:', projectsError)
      return {
        projects: [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    }

    if (!projects || projects.length === 0) {
      return {
        projects: [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    }

    // Get unique customer IDs
    const customerIds = [...new Set(projects.map(p => p.customer_id).filter(Boolean))]

    // Fetch customers in a separate query
    const { data: customers, error: customersError } = await supabaseServer
      .schema('customers')
      .from('customers')
      .select('id, name, name_en')
      .in('id', customerIds)

    if (customersError) {
      console.error('List customers error:', customersError)
    }

    // Create a map of customers by ID
    const customerMap = new Map(
      (customers || []).map(c => [c.id, c])
    )

    const projectList = projects.map((project: any) => {
      const customer = project.customer_id ? customerMap.get(project.customer_id) : null
      return {
        id: project.id,
        project_code: project.project_code,
        name: project.name,
        name_en: project.name_en,
        customer_name: customer?.name,
        customer_name_en: customer?.name_en,
        city: project.city,
        project_type: project.project_type,
        status: project.status,
        priority: project.priority,
        estimated_budget: project.estimated_budget,
        currency: project.currency,
        start_date: project.start_date,
        expected_completion_date: project.expected_completion_date,
        created_at: project.created_at,
      }
    })

    return {
      projects: projectList,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    }
  } catch (error) {
    console.error('List projects action error:', error)
    return {
      projects: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0
    }
  }
}

export async function getProjectByIdAction(projectId: string): Promise<ProjectDetail | null> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    // Get project details
    const { data: project, error: projectError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select('*')
      .eq('id', sanitizedProjectId)
      .single()

    if (projectError || !project) {
      console.error('Get project error:', projectError)
      return null
    }

    // Fetch customer separately if customer_id exists
    let customer = null
    if (project.customer_id) {
      const { data: customerData, error: customerError } = await supabaseServer
        .schema('customers')
        .from('customers')
        .select('id, name, name_en, email, phone')
        .eq('id', project.customer_id)
        .single()

      if (customerError) {
        console.error('Get customer error:', customerError)
      } else {
        customer = customerData
      }
    }

    // Get project products
    const { data: projectProducts, error: productsError } = await supabaseServer
      .schema('projects')
      .from('project_products')
      .select(`
        id,
        product_id,
        quantity,
        unit_price,
        discount_percent,
        total_price,
        room_location,
        mounting_height,
        status,
        notes
      `)
      .eq('project_id', sanitizedProjectId)
      .order('room_location')

    if (productsError) {
      console.error('Get project products error:', productsError)
    }

    // Fetch product details separately if we have products
    const products = []
    if (projectProducts && projectProducts.length > 0) {
      const productIds = projectProducts.map(p => p.product_id)

      const { data: productDetails, error: productDetailsError } = await supabaseServer
        .schema('items')
        .from('product_info')
        .select('product_id, foss_pid, description_short')
        .in('product_id', productIds)

      if (productDetailsError) {
        console.error('Get product details error:', productDetailsError)
      }

      // Create a map of product details by ID
      const productMap = new Map(
        (productDetails || []).map(p => [p.product_id, p])
      )

      // Combine project products with product details
      for (const pp of projectProducts) {
        const productDetail = productMap.get(pp.product_id)
        products.push({
          ...pp,
          foss_pid: productDetail?.foss_pid || '',
          description_short: productDetail?.description_short || ''
        })
      }
    }

    // Get contacts
    const { data: contacts, error: contactsError } = await supabaseServer
      .schema('projects')
      .from('project_contacts')
      .select('*')
      .eq('project_id', sanitizedProjectId)
      .order('is_primary', { ascending: false })

    if (contactsError) {
      console.error('Get project contacts error:', contactsError)
    }

    // Get documents
    const { data: documents, error: documentsError } = await supabaseServer
      .schema('projects')
      .from('project_documents')
      .select('*')
      .eq('project_id', sanitizedProjectId)
      .order('created_at', { ascending: false })

    if (documentsError) {
      console.error('Get project documents error:', documentsError)
    }

    // Get phases
    const { data: phases, error: phasesError } = await supabaseServer
      .schema('projects')
      .from('project_phases')
      .select('*')
      .eq('project_id', sanitizedProjectId)
      .order('phase_number')

    if (phasesError) {
      console.error('Get project phases error:', phasesError)
    }

    return {
      id: project.id,
      project_code: project.project_code,
      name: project.name,
      name_en: project.name_en,
      description: project.description,
      customer_id: project.customer_id,
      customer_name: customer?.name,
      customer_name_en: customer?.name_en,
      customer_email: customer?.email,
      customer_phone: customer?.phone,
      street_address: project.street_address,
      postal_code: project.postal_code,
      city: project.city,
      region: project.region,
      prefecture: project.prefecture,
      country: project.country,
      latitude: project.latitude,
      longitude: project.longitude,
      project_type: project.project_type,
      project_category: project.project_category,
      building_area_sqm: project.building_area_sqm,
      estimated_budget: project.estimated_budget,
      currency: project.currency,
      status: project.status,
      priority: project.priority,
      start_date: project.start_date,
      expected_completion_date: project.expected_completion_date,
      actual_completion_date: project.actual_completion_date,
      project_manager: project.project_manager,
      architect_firm: project.architect_firm,
      electrical_engineer: project.electrical_engineer,
      lighting_designer: project.lighting_designer,
      notes: project.notes,
      tags: project.tags,
      created_at: project.created_at,
      updated_at: project.updated_at,
      created_by: project.created_by,
      products: products,
      contacts: contacts || [],
      documents: documents || [],
      phases: phases || [],
    }
  } catch (error) {
    console.error('Get project by ID error:', error)
    return null
  }
}

// ============================================================================
// TAXONOMY & SUPPLIER ACTIONS
// ============================================================================

function validateTaxonomyCode(taxonomyCode: string): string {
  if (!taxonomyCode || typeof taxonomyCode !== 'string') {
    throw new Error('Invalid taxonomy code')
  }

  // Taxonomy codes follow pattern: CATEGORY-SUBCATEGORY-TYPE
  // Examples: LUMINAIRE, LUMINAIRE-CEILING, LUMINAIRE-CEILING-RECESSED
  const sanitized = taxonomyCode.trim().toUpperCase()
  const validPattern = /^[A-Z]+(-[A-Z]+)*$/

  if (!validPattern.test(sanitized) || sanitized.length > 100) {
    throw new Error('Invalid taxonomy code format')
  }

  return sanitized
}

function validateSupplierId(supplierId: number): number {
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw new Error('Invalid supplier ID')
  }
  return supplierId
}

export interface Supplier {
  id: number
  supplier_name: string
  code: string
  logo?: string
  logo_dark?: string
  country?: string
  product_count: number
}

/**
 * Fetch active suppliers with product counts
 */
export async function getActiveSuppliersAction(): Promise<Supplier[]> {
  try {
    // Get all suppliers
    const { data: suppliers, error: supplierError } = await supabaseServer
      .schema('items')
      .from('supplier')
      .select('id, supplier_name, code, logo, logo_dark, country')

    if (supplierError || !suppliers) {
      console.error('Error getting active suppliers:', supplierError)
      return []
    }

    // Get product counts using RPC (aggregated in DB, no row limit issues)
    const { data: supplierCounts, error: countError } = await supabaseServer
      .schema('search')
      .rpc('get_global_supplier_counts')

    if (countError) {
      console.error('Error counting products:', countError)
      return []
    }

    // Create map of supplier counts
    const supplierCountMap = new Map<string, number>()
    if (supplierCounts && Array.isArray(supplierCounts)) {
      supplierCounts.forEach((row: any) => {
        supplierCountMap.set(row.supplier_name, Number(row.product_count))
      })
    }

    // Map suppliers with their product counts
    const suppliersWithCounts: Supplier[] = suppliers.map((supplier: any) => ({
      id: supplier.id,
      supplier_name: supplier.supplier_name,
      code: supplier.code,
      logo: supplier.logo || undefined,
      logo_dark: supplier.logo_dark || undefined,
      country: supplier.country || undefined,
      product_count: supplierCountMap.get(supplier.supplier_name) || 0
    }))

    // Sort by product count descending, filter out suppliers with 0 products
    return suppliersWithCounts
      .filter(s => s.product_count > 0)
      .sort((a, b) => b.product_count - a.product_count)
  } catch (error) {
    console.error('Get active suppliers error:', error)
    return []
  }
}

/**
 * Fetch suppliers with product counts filtered by taxonomy (context-aware)
 */
export async function getSuppliersWithTaxonomyCountsAction(
  taxonomyCode?: string
): Promise<Supplier[]> {
  try {
    // Get all suppliers
    const { data: suppliers, error: supplierError } = await supabaseServer
      .schema('items')
      .from('supplier')
      .select('id, supplier_name, code, logo, logo_dark, country')

    if (supplierError || !suppliers) {
      console.error('Error getting suppliers:', supplierError)
      return []
    }

    // If no taxonomy filter, get global counts
    if (!taxonomyCode) {
      return getActiveSuppliersAction()
    }

    // Get product counts filtered by taxonomy using RPC function
    const { data: supplierCounts, error: countError } = await supabaseServer
      .schema('search')
      .rpc('get_supplier_counts_by_taxonomy', {
        p_taxonomy_code: taxonomyCode
      })

    if (countError) {
      console.error('Error counting products by taxonomy:', countError)
      return []
    }

    // Create map of supplier counts
    const supplierCountMap = new Map<string, number>()
    if (supplierCounts && Array.isArray(supplierCounts)) {
      supplierCounts.forEach((row: any) => {
        supplierCountMap.set(row.supplier_name, row.product_count)
      })
    }

    // Map suppliers with their filtered counts
    const suppliersWithCounts: Supplier[] = suppliers.map((supplier: any) => ({
      id: supplier.id,
      supplier_name: supplier.supplier_name,
      code: supplier.code,
      logo: supplier.logo || undefined,
      logo_dark: supplier.logo_dark || undefined,
      country: supplier.country || undefined,
      product_count: supplierCountMap.get(supplier.supplier_name) || 0
    }))

    // Sort by product count descending, filter out suppliers with 0 products
    return suppliersWithCounts
      .filter(s => s.product_count > 0)
      .sort((a, b) => b.product_count - a.product_count)
  } catch (error) {
    console.error('Get suppliers with taxonomy counts error:', error)
    return []
  }
}

export interface ProductByTaxonomy {
  product_id: string
  foss_pid: string
  description_short: string
  description_long: string
  supplier_name: string
  supplier_logo?: string
  supplier_logo_dark?: string
  prices: Array<{
    date: string
    disc1: number
    start_price: number
  }>
  multimedia?: Array<{
    mime_code: string
    mime_source: string
  }>
}

export interface ProductByTaxonomyResult {
  products: ProductByTaxonomy[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Get products filtered by taxonomy code and optional supplier (legacy - no pagination)
 */
export async function getProductsByTaxonomyAction(
  taxonomyCode: string,
  supplierId?: number
): Promise<ProductByTaxonomy[]> {
  try {
    const sanitizedTaxonomyCode = validateTaxonomyCode(taxonomyCode)
    const sanitizedSupplierId = supplierId ? validateSupplierId(supplierId) : null

    // Build the query - join taxonomy flags with product info
    // Note: taxonomy_path is an array, so we check if it contains the taxonomy code
    let query = supabaseServer
      .schema('search')
      .from('product_taxonomy_flags')
      .select(`
        product_id
      `)
      .contains('taxonomy_path', [sanitizedTaxonomyCode])
      .limit(100) // Limit early to avoid "Bad Request" with large result sets

    const { data: productIds, error: taxonomyError} = await query

    if (taxonomyError || !productIds) {
      console.error('Error getting products by taxonomy:', taxonomyError)
      return []
    }

    if (productIds.length === 0) {
      return []
    }

    // Get product details
    const ids = productIds.map(p => p.product_id)

    let productQuery = supabaseServer
      .schema('items')
      .from('product_info')
      .select('product_id, foss_pid, description_short, description_long, supplier_name, supplier_logo, supplier_logo_dark, prices, multimedia, catalog_id')
      .in('product_id', ids)

    // Filter by supplier if provided
    // Note: product_info has catalog_id, not supplier_id
    // We need to filter by catalog_ids that belong to this supplier
    if (sanitizedSupplierId) {
      // Get catalog IDs for this supplier
      const { data: catalogs, error: catalogError } = await supabaseServer
        .schema('items')
        .from('catalog')
        .select('id')
        .eq('supplier_id', sanitizedSupplierId)
        .eq('active', true)

      if (catalogError) {
        console.error('Error getting catalogs for supplier:', catalogError)
        return []
      }

      if (!catalogs || catalogs.length === 0) {
        return []
      }

      const catalogIds = catalogs.map(c => c.id)
      productQuery = productQuery.in('catalog_id', catalogIds)
    }

    const { data: products, error: productsError } = await productQuery
      .order('description_short')
      .limit(100)

    if (productsError) {
      console.error('Error fetching product details:', productsError)
      return []
    }

    return products || []
  } catch (error) {
    console.error('Get products by taxonomy error:', error)
    return []
  }
}

/**
 * Get paginated products filtered by taxonomy code and optional supplier
 */
export async function getProductsByTaxonomyPaginatedAction(
  taxonomyCode: string,
  options: {
    page?: number
    pageSize?: number
    supplierId?: number
  } = {}
): Promise<ProductByTaxonomyResult> {
  try {
    const page = options.page || 1
    const pageSize = options.pageSize || 20
    const offset = (page - 1) * pageSize

    const sanitizedTaxonomyCode = validateTaxonomyCode(taxonomyCode)
    const sanitizedSupplierId = options.supplierId ? validateSupplierId(options.supplierId) : null

    // Get supplier name for filter if provided
    let supplierName: string | undefined
    if (sanitizedSupplierId) {
      const { data: supplier, error: supplierError } = await supabaseServer
        .schema('items')
        .from('supplier')
        .select('supplier_name')
        .eq('id', sanitizedSupplierId)
        .single()

      if (supplierError || !supplier) {
        return {
          products: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      }

      supplierName = supplier.supplier_name
    }

    // Build base query for product IDs with taxonomy filter
    let allMatchingIds: string[] = []
    let total = 0

    if (supplierName) {
      // When supplier is filtered, we need to get products that match BOTH taxonomy AND supplier
      // First get all product IDs that match taxonomy
      const { data: taxonomyMatches, error: taxonomyError } = await supabaseServer
        .schema('search')
        .from('product_taxonomy_flags')
        .select('product_id')
        .contains('taxonomy_path', [sanitizedTaxonomyCode])

      if (taxonomyError || !taxonomyMatches) {
        console.error('Error getting products by taxonomy:', taxonomyError)
        return {
          products: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      }

      if (taxonomyMatches.length === 0) {
        return {
          products: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      }

      const taxonomyIds = taxonomyMatches.map(p => p.product_id)

      // Now get products that match both taxonomy AND supplier using RPC function
      // Use RPC to bypass PostgREST limitations with materialized views
      const { data: filteredProducts, error: filterError } = await supabaseServer
        .rpc('get_products_by_taxonomy_and_supplier', {
          p_taxonomy_ids: taxonomyIds,
          p_supplier_name: supplierName
        })

      if (filterError) {
        console.error('Error filtering products by supplier:', filterError)
        return {
          products: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      }

      allMatchingIds = (filteredProducts || []).map((p: { product_id: string }) => p.product_id)
      total = allMatchingIds.length
    } else {
      // No supplier filter - just count and get IDs from taxonomy
      const { count: totalCount, error: countError } = await supabaseServer
        .schema('search')
        .from('product_taxonomy_flags')
        .select('product_id', { count: 'exact', head: true })
        .contains('taxonomy_path', [sanitizedTaxonomyCode])

      if (countError) {
        console.error('Error counting products by taxonomy:', countError)
        return {
          products: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      }

      total = totalCount || 0

      if (total === 0) {
        return {
          products: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      }

      // Get only the product IDs for the current page
      const { data: productIds, error: taxonomyError } = await supabaseServer
        .schema('search')
        .from('product_taxonomy_flags')
        .select('product_id')
        .contains('taxonomy_path', [sanitizedTaxonomyCode])
        .range(offset, offset + pageSize - 1)

      if (taxonomyError || !productIds) {
        console.error('Error getting products by taxonomy:', taxonomyError)
        return {
          products: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      }

      allMatchingIds = productIds.map(p => p.product_id)
    }

    if (allMatchingIds.length === 0) {
      return {
        products: [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }

    // For supplier filtering, we already have all IDs, so paginate them
    const paginatedIds = supplierName
      ? allMatchingIds.slice(offset, offset + pageSize)
      : allMatchingIds

    if (paginatedIds.length === 0) {
      return {
        products: [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }

    // Get full product details for the paginated IDs
    const { data: products, error: productsError } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('product_id, foss_pid, description_short, description_long, supplier_name, supplier_logo, supplier_logo_dark, prices, multimedia, catalog_id')
      .in('product_id', paginatedIds)
      .order('description_short')

    if (productsError) {
      console.error('Error fetching product details:', productsError)
      return {
        products: [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }

    const result = {
      products: products || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }

    return result
  } catch (error) {
    console.error('Get products by taxonomy paginated error:', error)
    return {
      products: [],
      total: 0,
      page: options.page || 1,
      pageSize: options.pageSize || 20,
      totalPages: 0
    }
  }
}

/**
 * Fetch taxonomy hierarchy with dynamic product counts from database
 * Replaces hardcoded taxonomy data with live database queries
 */
export async function getTaxonomyWithCountsAction(): Promise<TaxonomyCategory[]> {
  try {
    // Fetch all taxonomy entries from database
    const { data: taxonomyData, error: taxonomyError } = await supabaseServer
      .schema('search')
      .from('taxonomy')
      .select('code, name, description, level, icon, parent_code, display_order')
      .eq('active', true)
      .order('display_order')
      .order('name')

    if (taxonomyError || !taxonomyData) {
      console.error('Error fetching taxonomy:', taxonomyError)
      return []
    }

    // Get product counts for each taxonomy code using taxonomy_path
    // This query counts products where the taxonomy code appears anywhere in the taxonomy_path array
    const countPromises = taxonomyData.map(async (tax) => {
      const { count, error } = await supabaseServer
        .schema('search')
        .from('product_taxonomy_flags')
        .select('product_id', { count: 'exact', head: true })
        .contains('taxonomy_path', [tax.code])

      if (error) {
        console.error(`Error counting products for ${tax.code}:`, error)
        return { code: tax.code, count: 0 }
      }

      return { code: tax.code, count: count || 0 }
    })

    const counts = await Promise.all(countPromises)
    const countMap = new Map(counts.map(c => [c.code, c.count]))

    // Build hierarchical structure
    const taxonomyMap = new Map<string, TaxonomyCategory>()

    // First pass: create all nodes
    taxonomyData.forEach(tax => {
      taxonomyMap.set(tax.code, {
        code: tax.code,
        name: tax.name,
        description: tax.description || '',
        level: tax.level,
        icon: tax.icon || 'Package',
        productCount: countMap.get(tax.code) || 0,
        children: []
      })
    })

    // Second pass: build parent-child relationships
    const rootCategories: TaxonomyCategory[] = []

    taxonomyData.forEach(tax => {
      const category = taxonomyMap.get(tax.code)
      if (!category) return

      // Level 1 categories are the root (even if they have parent_code='ROOT')
      if (tax.level === 1) {
        rootCategories.push(category)
      } else if (tax.parent_code && tax.parent_code !== 'ROOT') {
        // For level 2+, attach to parent
        const parent = taxonomyMap.get(tax.parent_code)
        if (parent) {
          if (!parent.children) parent.children = []
          parent.children.push(category)
        }
      }
    })

    return rootCategories
  } catch (error) {
    console.error('Error in getTaxonomyWithCountsAction:', error)
    return []
  }
}