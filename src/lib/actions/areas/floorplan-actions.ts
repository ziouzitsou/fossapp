'use server'

/**
 * Floor Plan Actions
 *
 * Floor plan and placement management for area revisions:
 * - Delete floor plans from area revisions
 * - Load and save fixture placements on floor plans
 */

import { supabaseServer } from '@fossapp/core/db/server'
import { deleteFloorPlanObject, generateObjectKey } from '../../planner/aps-planner-service'

import type { ActionResult } from '@fossapp/projects'

// ============================================================================
// DELETE FLOOR PLAN FROM AREA REVISION
// ============================================================================

/**
 * Remove floor plan from an area revision
 *
 * This deletes both the database reference AND the OSS file.
 * If other revisions need the file, use copyTo() when creating them.
 */
export async function deleteAreaRevisionFloorPlanAction(
  areaRevisionId: string
): Promise<ActionResult> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(areaRevisionId)) {
      return { success: false, error: 'Invalid area revision ID format' }
    }

    // Get the area revision with its floor plan info and area details
    const { data: areaRevision, error: fetchError } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .select(`
        id,
        revision_number,
        floor_plan_filename,
        floor_plan_urn,
        project_areas!inner (
          project_id,
          area_code
        )
      `)
      .eq('id', areaRevisionId)
      .single()

    if (fetchError || !areaRevision) {
      console.error('Fetch area revision error:', fetchError)
      return { success: false, error: 'Area revision not found' }
    }

    // Delete from OSS if file exists
    if (areaRevision.floor_plan_filename && areaRevision.floor_plan_urn) {
      // Type assertion for nested join data (Supabase returns object for !inner with single())
      const projectAreas = areaRevision.project_areas as unknown as { project_id: string; area_code: string }
      const objectKey = generateObjectKey(
        projectAreas.area_code,
        areaRevision.revision_number,
        areaRevision.floor_plan_filename
      )

      try {
        await deleteFloorPlanObject(projectAreas.project_id, objectKey)
      } catch (ossError) {
        // Log but don't fail - OSS deletion is best-effort
        console.warn('Failed to delete OSS object:', ossError)
      }
    }

    // Clear all floor plan fields from database
    const { error } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .update({
        floor_plan_urn: null,
        floor_plan_filename: null,
        floor_plan_hash: null,
        floor_plan_status: null,
        floor_plan_thumbnail_urn: null,
        floor_plan_warnings: null,
        floor_plan_manifest: null
      })
      .eq('id', areaRevisionId)

    if (error) {
      console.error('Delete floor plan error:', error)
      return { success: false, error: 'Failed to delete floor plan' }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete area revision floor plan error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete floor plan AND all placements from an area revision
 * Combines deleteAreaRevisionFloorPlanAction + clearAreaPlacementsAction
 */
export async function deleteFloorPlanWithPlacementsAction(
  areaRevisionId: string
): Promise<ActionResult<{ placementsDeleted: number }>> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(areaRevisionId)) {
      return { success: false, error: 'Invalid area revision ID format' }
    }

    // Count placements before deletion (for feedback)
    const countResult = await countAreaPlacementsAction(areaRevisionId)
    const placementCount = countResult.success ? countResult.data ?? 0 : 0

    // Delete placements first
    const clearResult = await clearAreaPlacementsAction(areaRevisionId)
    if (!clearResult.success) {
      return { success: false, error: clearResult.error || 'Failed to clear placements' }
    }

    // Then delete floor plan
    const deleteResult = await deleteAreaRevisionFloorPlanAction(areaRevisionId)
    if (!deleteResult.success) {
      return { success: false, error: deleteResult.error || 'Failed to delete floor plan' }
    }

    return { success: true, data: { placementsDeleted: placementCount } }
  } catch (error) {
    console.error('Delete floor plan with placements error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Count placements for an area revision
 * Used to show user how many placements will be deleted
 */
export async function countAreaPlacementsAction(
  areaRevisionId: string
): Promise<ActionResult<number>> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(areaRevisionId)) {
      return { success: false, error: 'Invalid area revision ID format' }
    }

    const { count, error } = await supabaseServer
      .schema('projects')
      .from('planner_placements')
      .select('*', { count: 'exact', head: true })
      .eq('area_version_id', areaRevisionId)

    if (error) {
      console.error('Count placements error:', error)
      return { success: false, error: 'Failed to count placements' }
    }

    return { success: true, data: count ?? 0 }
  } catch (error) {
    console.error('Count area placements error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Clear all placements for an area revision
 */
export async function clearAreaPlacementsAction(
  areaRevisionId: string
): Promise<ActionResult> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(areaRevisionId)) {
      return { success: false, error: 'Invalid area revision ID format' }
    }

    const { error } = await supabaseServer
      .schema('projects')
      .from('planner_placements')
      .delete()
      .eq('area_version_id', areaRevisionId)

    if (error) {
      console.error('Clear placements error:', error)
      return { success: false, error: 'Failed to clear placements' }
    }

    return { success: true }
  } catch (error) {
    console.error('Clear area placements error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// PLANNER PLACEMENTS
// ============================================================================

/**
 * Placement data structure for floor plan placements
 */
export interface PlacementData {
  id: string
  projectProductId: string
  productId: string
  productName: string
  symbol?: string  // Symbol label (e.g., "A1", "B2") for floor plan display
  worldX: number
  worldY: number
  rotation: number
}

/**
 * Load all placements for an area revision
 */
export async function loadAreaPlacementsAction(
  areaRevisionId: string
): Promise<ActionResult<PlacementData[]>> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(areaRevisionId)) {
      return { success: false, error: 'Invalid area revision ID format' }
    }

    const { data, error } = await supabaseServer
      .schema('projects')
      .rpc('get_area_placements', { p_area_revision_id: areaRevisionId })

    if (error) {
      console.error('Load placements error:', error)
      return { success: false, error: 'Failed to load placements' }
    }

    // Map database results to PlacementData format
    const placements: PlacementData[] = (data || []).map((row: {
      id: string
      project_product_id: string
      product_id: string
      product_name: string
      symbol?: string
      world_x: number
      world_y: number
      rotation: number
    }) => ({
      id: row.id,
      projectProductId: row.project_product_id,
      productId: row.product_id,
      productName: row.product_name,
      symbol: row.symbol,
      worldX: Number(row.world_x),
      worldY: Number(row.world_y),
      rotation: Number(row.rotation)
    }))

    return { success: true, data: placements }
  } catch (error) {
    console.error('Load area placements error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Save all placements for an area revision (atomic replace)
 * Deletes existing placements and inserts new ones in a transaction
 */
export async function saveAreaPlacementsAction(
  areaRevisionId: string,
  placements: PlacementData[]
): Promise<ActionResult> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(areaRevisionId)) {
      return { success: false, error: 'Invalid area revision ID format' }
    }

    // Call RPC function for atomic save
    const { error } = await supabaseServer
      .schema('projects')
      .rpc('save_area_placements', {
        p_area_revision_id: areaRevisionId,
        p_placements: placements
      })

    if (error) {
      console.error('Save placements error:', error)
      return { success: false, error: 'Failed to save placements' }
    }

    return { success: true }
  } catch (error) {
    console.error('Save area placements error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
