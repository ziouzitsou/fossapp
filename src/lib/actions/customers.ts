'use server'

import { supabaseServer } from '../supabase-server'
import { validateSearchQuery, validateCustomerId } from './validation'
import { PAGINATION } from '@/lib/constants'

// ============================================================================
// INTERFACES
// ============================================================================

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

// ============================================================================
// SEARCH
// ============================================================================

export async function searchCustomersAction(query: string): Promise<CustomerSearchResult[]> {
  try {
    const sanitizedQuery = validateSearchQuery(query)

    const { data, error } = await supabaseServer
      .schema('customers')
      .from('customers')
      .select('id, customer_code, name, name_en, email, phone, city, country, industry, company_type')
      .or(`name.ilike.%${sanitizedQuery}%,name_en.ilike.%${sanitizedQuery}%,customer_code.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%,city.ilike.%${sanitizedQuery}%`)
      .order('name')
      .limit(PAGINATION.DEFAULT_SEARCH_LIMIT)

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

// ============================================================================
// GET BY ID
// ============================================================================

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

// ============================================================================
// LIST WITH PAGINATION
// ============================================================================

export async function listCustomersAction(params: CustomerListParams = {}): Promise<CustomerListResult> {
  try {
    const {
      page = 1,
      pageSize = PAGINATION.DEFAULT_CUSTOMER_PAGE_SIZE,
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
      pageSize: PAGINATION.DEFAULT_CUSTOMER_PAGE_SIZE,
      totalPages: 0
    }
  }
}
