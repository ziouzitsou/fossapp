/**
 * XREF Data Service
 *
 * Database queries for fetching placement and symbol data.
 *
 * @module case-study/xref-data-service
 */

import { supabaseServer } from '@fossapp/core/db'
import { getGoogleDriveSymbolService } from '@/lib/symbol-generator/google-drive-symbol-service'
import type { PlacementData, SymbolInfo } from './xref-types'
import type { XrefPlacement } from './xref-script-generator'

/**
 * Fetch placements with product info from database
 *
 * @param areaRevisionId - Area revision UUID
 * @returns Placements with floor plan info
 */
export async function fetchPlacementData(areaRevisionId: string): Promise<{
  placements: PlacementData[]
  floorPlanUrn: string | null
  floorPlanFilename: string | null
}> {
  // Get floor plan info from area revision
  const { data: revision, error: revError } = await supabaseServer
    .schema('projects')
    .from('project_area_revisions')
    .select('floor_plan_urn, floor_plan_filename')
    .eq('id', areaRevisionId)
    .single()

  if (revError) {
    throw new Error(`Failed to fetch area revision: ${revError.message}`)
  }

  // Get placements with product foss_pid
  const { data: placementsRaw, error: placementsError } = await supabaseServer
    .schema('projects')
    .from('planner_placements')
    .select(`
      id,
      project_product_id,
      product_id,
      world_x,
      world_y,
      rotation,
      mirror_x,
      mirror_y,
      symbol,
      project_products!inner (
        product_id
      )
    `)
    .eq('area_version_id', areaRevisionId)

  if (placementsError) {
    throw new Error(`Failed to fetch placements: ${placementsError.message}`)
  }

  // Get product foss_pids
  const productIds = [...new Set(placementsRaw?.map(p => p.product_id) || [])]
  const { data: products, error: productsError } = await supabaseServer
    .schema('items')
    .from('product_info')
    .select('product_id, foss_pid')
    .in('product_id', productIds)

  if (productsError) {
    throw new Error(`Failed to fetch products: ${productsError.message}`)
  }

  const productMap = new Map(products?.map(p => [p.product_id, p.foss_pid]) || [])

  // Map placements with foss_pid
  const placements: PlacementData[] = (placementsRaw || []).map(p => ({
    id: p.id,
    project_product_id: p.project_product_id,
    product_id: p.product_id,
    world_x: Number(p.world_x),
    world_y: Number(p.world_y),
    rotation: Number(p.rotation) || 0,
    mirror_x: Boolean(p.mirror_x),
    mirror_y: Boolean(p.mirror_y),
    symbol: p.symbol,
    foss_pid: productMap.get(p.product_id),
  }))

  return {
    placements,
    floorPlanUrn: revision?.floor_plan_urn || null,
    floorPlanFilename: revision?.floor_plan_filename || null,
  }
}

/**
 * Get symbol info for unique products, checking which have DWGs
 *
 * @param placements - Placement data with foss_pids
 * @returns Symbol info array
 */
export async function getSymbolInfo(placements: PlacementData[]): Promise<SymbolInfo[]> {
  // Get unique foss_pids
  const uniqueFossPids = [...new Set(placements.map(p => p.foss_pid).filter(Boolean))] as string[]

  // Check which have DWG files in Supabase
  const { data: symbols, error } = await supabaseServer
    .schema('items')
    .from('product_symbols')
    .select('foss_pid, dwg_path')
    .in('foss_pid', uniqueFossPids)

  if (error) {
    console.warn('Failed to fetch symbol info:', error)
  }

  const symbolMap = new Map((symbols || []).map(s => [s.foss_pid, s.dwg_path]))

  const driveService = getGoogleDriveSymbolService()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  return uniqueFossPids.map(fossPid => {
    const dwgPath = symbolMap.get(fossPid)
    const hasDwg = Boolean(dwgPath)

    return {
      fossPid,
      localPath: driveService.getSymbolLocalPath(fossPid),
      supabaseUrl: hasDwg && supabaseUrl
        ? `${supabaseUrl}/storage/v1/object/public/product-symbols/${dwgPath}`
        : null,
      hasDwg,
    }
  })
}

/**
 * Build XREF placement data for script generation.
 * Uses placeholder for products without DWG symbols.
 *
 * @param placements - Placement data from database
 * @param symbols - Symbol info with DWG availability
 * @returns XREF placements for script generation
 */
export function buildXrefPlacements(
  placements: PlacementData[],
  symbols: SymbolInfo[]
): XrefPlacement[] {
  const symbolMap = new Map(symbols.map(s => [s.fossPid, s]))
  const driveService = getGoogleDriveSymbolService()
  const placeholderPath = driveService.getSymbolLocalPath('PLACEHOLDER')

  return placements
    .filter(p => p.foss_pid) // Only placements with products
    .map(p => {
      const symbolInfo = symbolMap.get(p.foss_pid!)
      const localPath = symbolInfo?.hasDwg
        ? symbolInfo.localPath
        : placeholderPath

      return {
        fossPid: p.foss_pid!,
        localPath,
        worldX: p.world_x,
        worldY: p.world_y,
        rotation: p.rotation,
        mirrorX: p.mirror_x,
        mirrorY: p.mirror_y,
        symbol: p.symbol || undefined,
      }
    })
}
