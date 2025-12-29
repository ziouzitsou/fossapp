'use server'

/**
 * Area Revision Products Actions
 *
 * Product-related operations for area revisions:
 * - Dropdown items for area selection
 * - List products within an area revision
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
  current_revision_id: string
  revision_number: number
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
        current_revision,
        project_area_revisions!inner (id, revision_number)
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

    // Map to dropdown items, finding the current revision ID
    const dropdownItems: AreaDropdownItem[] = areas.map(area => {
      const revisions = area.project_area_revisions as Array<{ id: string; revision_number: number }>
      const currentRevision = revisions.find(r => r.revision_number === area.current_revision)

      return {
        area_id: area.id,
        area_code: area.area_code,
        area_name: area.area_name,
        floor_level: area.floor_level,
        current_revision_id: currentRevision?.id || '',
        revision_number: area.current_revision
      }
    })

    return { success: true, data: dropdownItems }
  } catch (error) {
    console.error('Get areas for dropdown error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// LIST AREA REVISION PRODUCTS
// ============================================================================

export interface AreaRevisionProduct {
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
  // Symbol classification
  symbol_code?: string      // Letter code: A, B, C...
  symbol_sequence?: number  // Sequence: 1, 2, 3...
  symbol?: string           // Combined: A1, B2, C3...
  // Symbol drawing (from items.product_symbols)
  symbol_svg_path?: string  // Path in product-symbols bucket
}

/**
 * Get products for a specific area revision
 * Used by Planner to display available products for placement
 */
export async function listAreaRevisionProductsAction(
  areaRevisionId: string
): Promise<ActionResult<AreaRevisionProduct[]>> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(areaRevisionId)) {
      return { success: false, error: 'Invalid area revision ID format' }
    }

    // Use PostgreSQL function in projects schema to join across schemas
    const { data: products, error } = await supabaseServer
      .schema('projects')
      .rpc('get_area_revision_products', { p_area_revision_id: areaRevisionId })

    if (error) {
      console.error('List area revision products error:', error)
      return { success: false, error: 'Failed to fetch products' }
    }

    if (!products || products.length === 0) {
      return { success: true, data: [] }
    }

    // Get unique foss_pids to look up symbol drawings
    const fossPids = [...new Set(products.map((p: { foss_pid: string }) => p.foss_pid).filter(Boolean))]

    // Fetch symbol drawings for these products
    let symbolDrawings: Record<string, string> = {}
    if (fossPids.length > 0) {
      const { data: symbols } = await supabaseServer
        .schema('items')
        .from('product_symbols')
        .select('foss_pid, svg_path')
        .in('foss_pid', fossPids)
        .not('svg_path', 'is', null)

      if (symbols) {
        symbolDrawings = Object.fromEntries(
          symbols.map((s: { foss_pid: string; svg_path: string }) => [s.foss_pid, s.svg_path])
        )
      }
    }

    // Map RPC results to AreaRevisionProduct format
    const mappedProducts: AreaRevisionProduct[] = products.map((p: {
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
      category_code?: string
      symbol_sequence?: number
      symbol?: string
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
        notes: p.notes ?? undefined,
        // Symbol classification
        symbol_code: p.category_code ?? undefined,
        symbol_sequence: p.symbol_sequence ?? undefined,
        symbol: p.symbol ?? undefined,
        // Symbol drawing
        symbol_svg_path: symbolDrawings[p.foss_pid] ?? undefined
      }
    })

    return { success: true, data: mappedProducts }
  } catch (error) {
    console.error('List area revision products error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
