'use server'

/**
 * Area Version Products Actions
 *
 * Product-related operations for area versions:
 * - Dropdown items for area selection
 * - List products within an area version
 */

import { supabaseServer } from '@fossapp/core/db/server'
import { validateProjectId } from '@fossapp/core/validation'

import type { ActionResult } from '@fossapp/projects'

// ============================================================================
// GET AREAS FOR DROPDOWN (lightweight)
// ============================================================================

export interface AreaDropdownItem {
  area_id: string
  area_code: string
  area_name: string
  floor_level: number | null
  current_version_id: string
  version_number: number
}

/**
 * Get areas for a project - lightweight version for dropdowns
 * Returns only essential fields needed for area selection
 */
export async function getProjectAreasForDropdownAction(
  projectId: string
): Promise<ActionResult<AreaDropdownItem[]>> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    const { data: areas, error } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .select(`
        id,
        area_code,
        area_name,
        floor_level,
        current_version,
        project_area_versions!inner (id, version_number)
      `)
      .eq('project_id', sanitizedProjectId)
      .eq('is_active', true)
      .order('display_order')
      .order('floor_level', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('Get areas for dropdown error:', error)
      return { success: false, error: 'Failed to fetch areas' }
    }

    if (!areas || areas.length === 0) {
      return { success: true, data: [] }
    }

    // Map to dropdown items, finding the current version ID
    const dropdownItems: AreaDropdownItem[] = areas.map(area => {
      const versions = area.project_area_versions as Array<{ id: string; version_number: number }>
      const currentVersion = versions.find(v => v.version_number === area.current_version)

      return {
        area_id: area.id,
        area_code: area.area_code,
        area_name: area.area_name,
        floor_level: area.floor_level,
        current_version_id: currentVersion?.id || '',
        version_number: area.current_version
      }
    })

    return { success: true, data: dropdownItems }
  } catch (error) {
    console.error('Get areas for dropdown error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// LIST AREA VERSION PRODUCTS
// ============================================================================

export interface AreaVersionProduct {
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

/**
 * Get products for a specific area version
 * Used by Planner to display available products for placement
 */
export async function listAreaVersionProductsAction(
  areaVersionId: string
): Promise<ActionResult<AreaVersionProduct[]>> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(areaVersionId)) {
      return { success: false, error: 'Invalid area version ID format' }
    }

    // Use PostgreSQL function in projects schema to join across schemas
    const { data: products, error } = await supabaseServer
      .schema('projects')
      .rpc('get_area_version_products', { p_area_version_id: areaVersionId })

    if (error) {
      console.error('List area version products error:', error)
      return { success: false, error: 'Failed to fetch products' }
    }

    if (!products || products.length === 0) {
      return { success: true, data: [] }
    }

    // Map RPC results to AreaVersionProduct format
    const mappedProducts: AreaVersionProduct[] = products.map((p: {
      id: string
      product_id: string
      foss_pid: string
      description_short: string
      quantity: number
      unit_price?: number
      discount_percent?: number
      room_location?: string
      mounting_height?: number
      status?: string
      notes?: string
    }) => {
      const unitPrice = p.unit_price || 0
      const quantity = p.quantity || 0
      const discount = p.discount_percent || 0
      const totalPrice = unitPrice * quantity * (1 - discount / 100)

      return {
        id: p.id,
        product_id: p.product_id,
        foss_pid: p.foss_pid || 'Unknown',
        description_short: p.description_short || 'Unknown Product',
        quantity: p.quantity,
        unit_price: p.unit_price ?? undefined,
        discount_percent: p.discount_percent ?? undefined,
        total_price: totalPrice > 0 ? totalPrice : undefined,
        room_location: p.room_location ?? undefined,
        mounting_height: p.mounting_height ?? undefined,
        status: p.status || 'active',
        notes: p.notes ?? undefined
      }
    })

    return { success: true, data: mappedProducts }
  } catch (error) {
    console.error('List area version products error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
