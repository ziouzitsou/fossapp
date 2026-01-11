'use server'

/**
 * Area Revision Actions
 *
 * Revision management for project areas: create, set current, get all, delete.
 * Each area can have multiple revisions, allowing iteration on designs.
 */

import { supabaseServer } from '@fossapp/core/db/server'
import {
  createAreaRevisionFolderAction,
  deleteAreaRevisionFolderAction,
} from '../project-drive'

import type {
  AreaRevision,
  CreateRevisionInput,
  ActionResult,
} from '@fossapp/projects'

// Type for the RPC function return
type RevisionSummary = {
  product_count: number
  total_cost: number
}

// ============================================================================
// CREATE NEW REVISION
// ============================================================================

export async function createAreaRevisionAction(
  input: CreateRevisionInput
): Promise<ActionResult<{ id: string; revision_number: number; google_drive_folder_id?: string }>> {
  try {
    // Get the area to find next revision number and Drive folder ID
    const { data: area, error: areaError } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .select('current_revision, google_drive_folder_id')
      .eq('id', input.area_id)
      .single()

    if (areaError || !area) {
      return { success: false, error: 'Area not found' }
    }

    const newRevisionNumber = area.current_revision + 1

    // Create new revision
    const { data: newRevision, error: revisionError } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .insert({
        area_id: input.area_id,
        revision_number: newRevisionNumber,
        revision_name: input.revision_name?.trim() || `Revision ${newRevisionNumber}`,
        notes: input.notes?.trim() || null,
        created_by: input.created_by || null,
        status: 'draft'
      })
      .select('id')
      .single()

    if (revisionError) {
      console.error('Create revision error:', revisionError)
      return { success: false, error: 'Failed to create new revision' }
    }

    // Try to create Google Drive folder for this revision
    let driveFolderId: string | undefined
    if (area.google_drive_folder_id) {
      try {
        const driveResult = await createAreaRevisionFolderAction(
          area.google_drive_folder_id,
          newRevisionNumber
        )
        if (driveResult.success && driveResult.data) {
          driveFolderId = driveResult.data.revisionFolderId

          // Update revision with Drive folder ID
          await supabaseServer
            .schema('projects')
            .from('project_area_revisions')
            .update({ google_drive_folder_id: driveFolderId })
            .eq('id', newRevision.id)
        }
      } catch (driveError) {
        // Log but don't fail - Drive folder is optional
        console.warn('Failed to create Drive folder for revision:', driveError)
      }
    }

    // If copy_from_revision is specified, copy products and floor plan
    if (input.copy_from_revision) {
      const { data: sourceRevision } = await supabaseServer
        .schema('projects')
        .from('project_area_revisions')
        .select('id, revision_number, floor_plan_urn, floor_plan_filename, floor_plan_hash')
        .eq('area_id', input.area_id)
        .eq('revision_number', input.copy_from_revision)
        .single()

      if (sourceRevision) {
        // Get products from source revision
        const { data: products } = await supabaseServer
          .schema('projects')
          .from('project_products')
          .select('*')
          .eq('area_revision_id', sourceRevision.id)

        if (products && products.length > 0) {
          // Copy products to new revision
          const newProducts = products.map(p => ({
            project_id: p.project_id,
            product_id: p.product_id,
            area_revision_id: newRevision.id,
            quantity: p.quantity,
            unit_price: p.unit_price,
            discount_percent: p.discount_percent,
            room_location: p.room_location,
            mounting_height: p.mounting_height,
            status: p.status,
            notes: p.notes
          }))

          await supabaseServer
            .schema('projects')
            .from('project_products')
            .insert(newProducts)
        }

        // Copy floor plan if source revision has one
        if (sourceRevision.floor_plan_urn && sourceRevision.floor_plan_filename) {
          try {
            // Get project's OSS bucket, project_code, and area_code
            const { data: areaWithProject } = await supabaseServer
              .schema('projects')
              .from('project_areas')
              .select('project_id, area_code, projects!inner(oss_bucket, project_code)')
              .eq('id', input.area_id)
              .single()

            const projectData = areaWithProject?.projects as unknown as {
              oss_bucket: string | null
              project_code: string
            } | null
            const bucketName = projectData?.oss_bucket
            const projectCode = projectData?.project_code
            const areaCode = areaWithProject?.area_code

            if (bucketName && projectCode && areaCode) {
              // Import APS service functions
              const {
                generateObjectKey,
                copyFloorPlanInBucket,
                translateToSVF2
              } = await import('../../planner')

              // Build source and target object keys using naming convention
              const sourceObjectKey = generateObjectKey(
                projectCode,
                areaCode,
                sourceRevision.revision_number
              )
              const targetObjectKey = generateObjectKey(
                projectCode,
                areaCode,
                newRevisionNumber
              )

              // Copy the DWG file in OSS bucket
              const { urn: newUrn } = await copyFloorPlanInBucket(
                bucketName,
                sourceObjectKey,
                targetObjectKey
              )

              // Start translation for the copied file
              await translateToSVF2(newUrn)

              // Update new revision with floor plan info
              await supabaseServer
                .schema('projects')
                .from('project_area_revisions')
                .update({
                  floor_plan_urn: newUrn,
                  floor_plan_filename: sourceRevision.floor_plan_filename,
                  floor_plan_hash: sourceRevision.floor_plan_hash
                })
                .eq('id', newRevision.id)

              console.log(`[Areas] Copied floor plan to new revision ${newRevisionNumber}`)
            }
          } catch (floorPlanError) {
            // Log but don't fail - floor plan copy is optional
            console.warn('Failed to copy floor plan to new revision:', floorPlanError)
          }
        }
      }
    }

    // Update area's current_revision
    await supabaseServer
      .schema('projects')
      .from('project_areas')
      .update({
        current_revision: newRevisionNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.area_id)

    return {
      success: true,
      data: {
        id: newRevision.id,
        revision_number: newRevisionNumber,
        google_drive_folder_id: driveFolderId
      }
    }
  } catch (error) {
    console.error('Create revision error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// SET CURRENT REVISION
// ============================================================================

export async function setAreaCurrentRevisionAction(
  areaId: string,
  revisionNumber: number
): Promise<ActionResult> {
  try {
    // Verify revision exists
    const { data: revision, error: revisionError } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .select('id')
      .eq('area_id', areaId)
      .eq('revision_number', revisionNumber)
      .single()

    if (revisionError || !revision) {
      return { success: false, error: 'Revision not found' }
    }

    // Update current_revision
    const { error } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .update({
        current_revision: revisionNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', areaId)

    if (error) {
      console.error('Set current revision error:', error)
      return { success: false, error: 'Failed to set current revision' }
    }

    return { success: true }
  } catch (error) {
    console.error('Set current revision error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// GET ALL REVISIONS FOR AREA
// ============================================================================

export async function getAreaRevisionsAction(
  areaId: string
): Promise<ActionResult<AreaRevision[]>> {
  try {
    const { data: revisions, error } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .select('*')
      .eq('area_id', areaId)
      .order('revision_number', { ascending: false })

    if (error) {
      console.error('Get revisions error:', error)
      return { success: false, error: 'Failed to fetch revisions' }
    }

    // Get product count and cost for each revision
    const revisionsWithSummary = await Promise.all(
      (revisions || []).map(async (r) => {
        const { data: summary } = await supabaseServer
          .schema('projects')
          .rpc('get_area_revision_summary', { p_area_revision_id: r.id })
          .single()

        const typedSummary = summary as RevisionSummary | null
        return {
          ...r,
          product_count: typedSummary?.product_count || 0,
          total_cost: typedSummary?.total_cost || 0
        }
      })
    )

    return { success: true, data: revisionsWithSummary }
  } catch (error) {
    console.error('Get revisions error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// DELETE REVISION (only if not current)
// ============================================================================

export async function deleteAreaRevisionAction(
  areaRevisionId: string
): Promise<ActionResult> {
  try {
    // Get revision info including Drive folder ID
    const { data: revision, error: revisionError } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .select('area_id, revision_number, google_drive_folder_id')
      .eq('id', areaRevisionId)
      .single()

    if (revisionError || !revision) {
      return { success: false, error: 'Revision not found' }
    }

    // Check if it's the current revision
    const { data: area } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .select('current_revision')
      .eq('id', revision.area_id)
      .single()

    if (area && area.current_revision === revision.revision_number) {
      return { success: false, error: 'Cannot delete the current active revision' }
    }

    const driveFolderId = revision.google_drive_folder_id

    // Delete the revision (cascade will delete associated products)
    const { error } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .delete()
      .eq('id', areaRevisionId)

    if (error) {
      console.error('Delete revision error:', error)
      return { success: false, error: 'Failed to delete revision' }
    }

    // Try to delete the Drive folder if it exists
    if (driveFolderId) {
      try {
        await deleteAreaRevisionFolderAction(driveFolderId)
      } catch (driveError) {
        // Log but don't fail - manual cleanup may be needed
        console.warn('Failed to delete Drive folder for revision:', driveError)
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete revision error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
