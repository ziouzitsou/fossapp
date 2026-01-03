'use server'

/**
 * Case Study Server Actions
 *
 * Specialized actions for the Case Study page that combine existing
 * actions into optimized queries for this specific use case.
 */

import { supabaseServer } from '@fossapp/core/db/server'
import {
  loadAreaPlacementsAction,
  saveAreaPlacementsAction,
  countAreaPlacementsAction,
  deleteFloorPlanWithPlacementsAction,
  type PlacementData,
} from '@/lib/actions/areas/floorplan-actions'
import { updateProjectProductQuantityAction } from '@/lib/actions/projects/project-product-actions'

import type { ActionResult } from '@fossapp/projects'
import type {
  CaseStudyArea,
  LuminaireProduct,
  AccessoryProduct,
  Placement,
} from '../types'

// ============================================================================
// RE-EXPORT EXISTING ACTIONS
// ============================================================================

export {
  loadAreaPlacementsAction,
  saveAreaPlacementsAction,
  countAreaPlacementsAction,
  deleteFloorPlanWithPlacementsAction,
  updateProjectProductQuantityAction,
  type PlacementData,
}

// ============================================================================
// GET AREAS FOR PROJECT
// ============================================================================

/**
 * Get all areas for a project with their current revision info.
 * Optimized for the Case Study dropdown.
 */
export async function getCaseStudyAreasAction(
  projectId: string
): Promise<ActionResult<CaseStudyArea[]>> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(projectId)) {
      return { success: false, error: 'Invalid project ID format' }
    }

    // Get areas with their current revision data
    const { data: areas, error } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .select(`
        id,
        area_code,
        area_name,
        current_revision,
        project_area_revisions (
          id,
          revision_number,
          floor_plan_urn,
          floor_plan_filename,
          floor_plan_status
        )
      `)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('display_order')
      .order('floor_level', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('Get case study areas error:', error)
      return { success: false, error: 'Failed to fetch areas' }
    }

    if (!areas || areas.length === 0) {
      return { success: true, data: [] }
    }

    // Map to CaseStudyArea format, finding the current revision
    const caseStudyAreas: CaseStudyArea[] = areas.map((area) => {
      const revisions = area.project_area_revisions as Array<{
        id: string
        revision_number: number
        floor_plan_urn?: string
        floor_plan_filename?: string
        floor_plan_status?: string
      }>

      const currentRevision = revisions.find(
        (r) => r.revision_number === area.current_revision
      )

      return {
        id: area.id,
        areaCode: area.area_code,
        areaName: area.area_name,
        revisionId: currentRevision?.id ?? '',
        revisionNumber: area.current_revision,
        floorPlanUrn: currentRevision?.floor_plan_urn,
        floorPlanFilename: currentRevision?.floor_plan_filename,
        floorPlanStatus: currentRevision?.floor_plan_status as
          | 'pending'
          | 'inprogress'
          | 'success'
          | 'failed'
          | undefined,
      }
    })

    return { success: true, data: caseStudyAreas }
  } catch (error) {
    console.error('Get case study areas error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// GET PRODUCTS FOR AREA REVISION
// ============================================================================

interface ProductsResult {
  luminaires: LuminaireProduct[]
  accessories: AccessoryProduct[]
}

/**
 * Get all products for an area revision, categorized into luminaires and accessories.
 * Includes symbol info for luminaires.
 */
export async function getCaseStudyProductsAction(
  areaRevisionId: string
): Promise<ActionResult<ProductsResult>> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(areaRevisionId)) {
      return { success: false, error: 'Invalid area revision ID format' }
    }

    // Use the RPC function to get products with joined data
    const { data: products, error } = await supabaseServer
      .schema('projects')
      .rpc('get_area_revision_products', { p_area_revision_id: areaRevisionId })

    if (error) {
      console.error('Get case study products error:', error)
      return { success: false, error: 'Failed to fetch products' }
    }

    if (!products || products.length === 0) {
      return { success: true, data: { luminaires: [], accessories: [] } }
    }

    // Get unique foss_pids to look up symbol drawings and multimedia
    const fossPids = [
      ...new Set(
        products.map((p: { foss_pid: string }) => p.foss_pid).filter(Boolean)
      ),
    ]

    // Fetch symbol drawings and multimedia in parallel
    const [symbolsResult, multimediaResult] = await Promise.all([
      // Symbol drawings (PNG/SVG from product-symbols bucket)
      fossPids.length > 0
        ? supabaseServer
            .schema('items')
            .from('product_symbols')
            .select('foss_pid, png_path, svg_path')
            .in('foss_pid', fossPids)
        : { data: null },

      // Multimedia for images (MD01/MD02 = product photo, MD12/MD64 = line drawing)
      fossPids.length > 0
        ? supabaseServer
            .schema('items')
            .from('product_info')
            .select('foss_pid, multimedia')
            .in('foss_pid', fossPids)
        : { data: null },
    ])

    // Build lookup maps
    const symbolDrawings: Record<string, { pngPath?: string; svgPath?: string }> = {}
    if (symbolsResult.data) {
      for (const s of symbolsResult.data) {
        symbolDrawings[s.foss_pid] = {
          pngPath: s.png_path || undefined,
          svgPath: s.svg_path || undefined,
        }
      }
    }

    // BMEcat multimedia uses mime_code/mime_source naming
    const multimediaMap: Record<string, { imageUrl?: string; drawingUrl?: string }> = {}
    if (multimediaResult.data) {
      for (const m of multimediaResult.data) {
        const media = m.multimedia as Array<{ mime_code: string; mime_source: string }> | null
        if (media && Array.isArray(media)) {
          // Photo: MD02 (Supabase) -> MD01 (Supplier) - consistent with symbol-modal
          const md02 = media.find((c) => c.mime_code === 'MD02')
          const md01 = media.find((c) => c.mime_code === 'MD01')
          // Drawing: MD64 (Supabase) -> MD12 (Supplier) - consistent with symbol-modal
          const md64 = media.find((c) => c.mime_code === 'MD64')
          const md12 = media.find((c) => c.mime_code === 'MD12')

          multimediaMap[m.foss_pid] = {
            imageUrl: md02?.mime_source || md01?.mime_source,
            drawingUrl: md64?.mime_source || md12?.mime_source,
          }
        }
      }
    }

    // Count placements per product
    const { data: placementCounts } = await supabaseServer
      .schema('projects')
      .from('planner_placements')
      .select('project_product_id')
      .eq('area_version_id', areaRevisionId)

    const placementCountMap: Record<string, number> = {}
    if (placementCounts) {
      for (const p of placementCounts) {
        placementCountMap[p.project_product_id] =
          (placementCountMap[p.project_product_id] || 0) + 1
      }
    }

    // Categorize products by ETIM group:
    // - EG000027 = Luminaires
    // - EG000030 = Accessories, Drivers, Control gear
    // - Other/null = classify by name heuristics
    const luminaires: LuminaireProduct[] = []
    const accessories: AccessoryProduct[] = []

    const LUMINAIRES_GROUP = 'EG000027'
    const ACCESSORIES_GROUP = 'EG000030'

    for (const p of products as Array<{
      id: string
      product_id: string
      foss_pid: string
      description_short: string
      quantity: number
      category_code?: string
      symbol_sequence?: number
      symbol?: string
      etim_group_id?: string
    }>) {
      const media = multimediaMap[p.foss_pid] || {}
      const symbols = symbolDrawings[p.foss_pid] || {}

      // Classify by ETIM group (EG000027 = Luminaires)
      const isLuminaire = p.etim_group_id === LUMINAIRES_GROUP

      if (isLuminaire) {
        // Luminaire - use symbol if available, otherwise "?"
        const hasSymbolAssigned = Boolean(p.category_code && p.symbol_sequence)
        luminaires.push({
          id: p.id,
          productId: p.product_id,
          name: p.description_short || 'Unknown Product',
          code: p.foss_pid || '',
          type: 'luminaire',
          // Use assigned symbol, or "?" if not yet classified
          symbol: hasSymbolAssigned
            ? (p.symbol || `${p.category_code}${p.symbol_sequence}`)
            : '?',
          symbolLetter: p.category_code || '',
          symbolSequence: p.symbol_sequence || 0,
          hasSymbolDrawing: Boolean(symbols.svgPath || symbols.pngPath),
          hasTile: false, // TODO: Check tiles table
          tileAccessoryCount: 0,
          quantity: p.quantity,
          placed: placementCountMap[p.id] || 0,
          imageUrl: media.imageUrl,
          drawingUrl: media.drawingUrl || symbols.svgPath,
        })
      } else {
        // Accessory - determine type by ETIM group or name heuristics
        let productType: 'driver' | 'optic' | 'mount' | 'accessory' = 'accessory'
        const nameLower = (p.description_short || '').toLowerCase()

        // EG000030 contains drivers and control gear
        if (p.etim_group_id === ACCESSORIES_GROUP) {
          if (nameLower.includes('driver') || nameLower.includes('dali') || nameLower.includes('power supply')) {
            productType = 'driver'
          }
        } else {
          // Fallback to name heuristics for other groups
          if (nameLower.includes('driver') || nameLower.includes('dali')) {
            productType = 'driver'
          } else if (nameLower.includes('optic') || nameLower.includes('lens')) {
            productType = 'optic'
          } else if (nameLower.includes('mount') || nameLower.includes('bracket')) {
            productType = 'mount'
          }
        }

        accessories.push({
          id: p.id,
          productId: p.product_id,
          name: p.description_short || 'Unknown Product',
          code: p.foss_pid || '',
          type: productType,
          quantity: p.quantity,
          imageUrl: media.imageUrl,
          drawingUrl: media.drawingUrl,
        })
      }
    }

    return { success: true, data: { luminaires, accessories } }
  } catch (error) {
    console.error('Get case study products error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// GET PLACEMENTS FOR AREA REVISION
// ============================================================================

/**
 * Get all placements for an area revision.
 * Converts from database format to Case Study format.
 */
export async function getCaseStudyPlacementsAction(
  areaRevisionId: string
): Promise<ActionResult<Placement[]>> {
  try {
    const result = await loadAreaPlacementsAction(areaRevisionId)

    if (!result.success) {
      return result as ActionResult<Placement[]>
    }

    // Convert PlacementData to Placement format
    const placements: Placement[] = (result.data || []).map((p) => ({
      id: p.id,
      projectProductId: p.projectProductId,
      productId: p.productId,
      symbol: p.symbol || '',
      worldX: p.worldX,
      worldY: p.worldY,
      rotation: p.rotation,
    }))

    return { success: true, data: placements }
  } catch (error) {
    console.error('Get case study placements error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// SAVE PLACEMENTS
// ============================================================================

/**
 * Round a number to 0.1mm precision (1 decimal place).
 * This avoids storing excessive precision in the database and
 * prevents potential floating-point comparison issues.
 */
function roundTo01mm(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Save all placements for an area revision (atomic replace).
 * Coordinates are rounded to 0.1mm precision before saving.
 */
export async function saveCaseStudyPlacementsAction(
  areaRevisionId: string,
  placements: Placement[],
  luminaires: LuminaireProduct[]
): Promise<ActionResult> {
  try {
    // Convert to PlacementData format with 0.1mm precision
    const placementData: PlacementData[] = placements.map((p) => {
      const luminaire = luminaires.find((l) => l.id === p.projectProductId)
      return {
        id: p.id,
        projectProductId: p.projectProductId,
        productId: p.productId,
        productName: luminaire?.name || '',
        symbol: p.symbol,
        worldX: roundTo01mm(p.worldX),
        worldY: roundTo01mm(p.worldY),
        rotation: roundTo01mm(p.rotation),
      }
    })

    return await saveAreaPlacementsAction(areaRevisionId, placementData)
  } catch (error) {
    console.error('Save case study placements error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// UPDATE PRODUCT QUANTITY
// ============================================================================

/**
 * Update product quantity with validation.
 */
export async function updateCaseStudyQuantityAction(
  projectProductId: string,
  quantity: number
): Promise<ActionResult> {
  if (quantity < 1) {
    return { success: false, error: 'Quantity must be at least 1' }
  }

  return await updateProjectProductQuantityAction(projectProductId, quantity)
}
