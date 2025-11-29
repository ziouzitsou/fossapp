'use server'

import { supabaseServer } from '../supabase-server'

// ============================================================================
// INTERFACES
// ============================================================================

export interface DashboardStats {
  totalProducts: number
  totalSuppliers: number
  totalFamilies: number
}

export interface SupplierStats {
  supplier_name: string
  product_count: number
  supplier_logo?: string
  supplier_logo_dark?: string
}

export interface FamilyStats {
  family: string
  product_count: number
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

export interface ActiveUser {
  user_email: string
  event_count: number
  last_activity: string
  first_activity: string
  unique_days_active: number
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

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
    // Use optimized database function (single query instead of 3)
    const { data, error } = await supabaseServer
      .schema('items')
      .rpc('get_dashboard_stats')

    if (error) {
      console.error('Error getting dashboard stats:', error)
      return {
        totalProducts: 0,
        totalSuppliers: 0,
        totalFamilies: 0
      }
    }

    // RPC returns array with single row
    const stats = data?.[0] || { total_products: 0, total_suppliers: 0, total_families: 0 }

    return {
      totalProducts: Number(stats.total_products) || 0,
      totalSuppliers: Number(stats.total_suppliers) || 0,
      totalFamilies: Number(stats.total_families) || 0
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

// ============================================================================
// SUPPLIER STATS
// ============================================================================

export async function getSupplierStatsAction(): Promise<SupplierStats[]> {
  try {
    // Use optimized database function (aggregates at DB level instead of fetching 56K rows)
    const { data, error } = await supabaseServer
      .schema('items')
      .rpc('get_supplier_stats')

    if (error) {
      console.error('Error getting supplier stats:', error)
      return []
    }

    // Map DB response to TypeScript interface
    return (data || []).map((item: { supplier_name: string; product_count: number; supplier_logo: string | null; supplier_logo_dark: string | null }) => ({
      supplier_name: item.supplier_name,
      product_count: Number(item.product_count),
      supplier_logo: item.supplier_logo || undefined,
      supplier_logo_dark: item.supplier_logo_dark || undefined
    }))
  } catch (error) {
    console.error('Supplier stats error:', error)
    return []
  }
}

// ============================================================================
// FAMILY STATS
// ============================================================================

export async function getTopFamiliesAction(limit: number = 10): Promise<FamilyStats[]> {
  try {
    // Use optimized database function (aggregates at DB level instead of fetching 56K rows)
    const { data, error } = await supabaseServer
      .schema('items')
      .rpc('get_top_families', { p_limit: limit })

    if (error) {
      console.error('Error getting families:', error)
      return []
    }

    // Map DB response to TypeScript interface
    return (data || []).map((item: { family: string; product_count: number }) => ({
      family: item.family,
      product_count: Number(item.product_count)
    }))
  } catch (error) {
    console.error('Families error:', error)
    return []
  }
}

// ============================================================================
// ACTIVE USERS (Analytics)
// ============================================================================

export async function getMostActiveUsersAction(limit: number = 5): Promise<ActiveUser[]> {
  try {
    // Use analytics schema function
    const { data, error } = await supabaseServer
      .schema('analytics')
      .rpc('get_most_active_users', { p_limit: limit })

    if (error) {
      console.error('Error getting most active users:', error)
      return []
    }

    return (data || []).map((item: {
      user_email: string
      event_count: number
      last_activity: string
      first_activity: string
      unique_days_active: number
    }) => ({
      user_email: item.user_email,
      event_count: Number(item.event_count),
      last_activity: item.last_activity,
      first_activity: item.first_activity,
      unique_days_active: Number(item.unique_days_active)
    }))
  } catch (error) {
    console.error('Most active users error:', error)
    return []
  }
}
