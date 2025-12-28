'use server'

/**
 * Area Version Actions
 *
 * Version management for project areas: create, set current, get all, delete.
 * Each area can have multiple versions, allowing iteration on designs.
 */

import { supabaseServer } from '@fossapp/core/db/server'
import {
  createAreaVersionFolderAction,
  deleteAreaVersionFolderAction,
} from '../project-drive'

import type {
  AreaVersion,
  CreateVersionInput,
  ActionResult,
} from '@fossapp/projects'

// Type for the RPC function return
type VersionSummary = {
  product_count: number
  total_cost: number
}

// ============================================================================
// CREATE NEW VERSION
// ============================================================================

export async function createAreaVersionAction(
  input: CreateVersionInput
): Promise<ActionResult<{ id: string; version_number: number; google_drive_folder_id?: string }>> {
  try {
    // Get the area to find next version number and Drive folder ID
    const { data: area, error: areaError } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .select('current_version, google_drive_folder_id')
      .eq('id', input.area_id)
      .single()

    if (areaError || !area) {
      return { success: false, error: 'Area not found' }
    }

    const newVersionNumber = area.current_version + 1

    // Create new version
    const { data: newVersion, error: versionError } = await supabaseServer
      .schema('projects')
      .from('project_area_versions')
      .insert({
        area_id: input.area_id,
        version_number: newVersionNumber,
        version_name: input.version_name?.trim() || `Version ${newVersionNumber}`,
        notes: input.notes?.trim() || null,
        created_by: input.created_by || null,
        status: 'draft'
      })
      .select('id')
      .single()

    if (versionError) {
      console.error('Create version error:', versionError)
      return { success: false, error: 'Failed to create new version' }
    }

    // Try to create Google Drive folder for this version
    let driveFolderId: string | undefined
    if (area.google_drive_folder_id) {
      try {
        const driveResult = await createAreaVersionFolderAction(
          area.google_drive_folder_id,
          newVersionNumber
        )
        if (driveResult.success && driveResult.data) {
          driveFolderId = driveResult.data.versionFolderId

          // Update version with Drive folder ID
          await supabaseServer
            .schema('projects')
            .from('project_area_versions')
            .update({ google_drive_folder_id: driveFolderId })
            .eq('id', newVersion.id)
        }
      } catch (driveError) {
        // Log but don't fail - Drive folder is optional
        console.warn('Failed to create Drive folder for version:', driveError)
      }
    }

    // If copy_from_version is specified, copy products and floor plan
    if (input.copy_from_version) {
      const { data: sourceVersion } = await supabaseServer
        .schema('projects')
        .from('project_area_versions')
        .select('id, floor_plan_urn, floor_plan_filename, floor_plan_hash')
        .eq('area_id', input.area_id)
        .eq('version_number', input.copy_from_version)
        .single()

      if (sourceVersion) {
        // Get products from source version
        const { data: products } = await supabaseServer
          .schema('projects')
          .from('project_products')
          .select('*')
          .eq('area_version_id', sourceVersion.id)

        if (products && products.length > 0) {
          // Copy products to new version
          const newProducts = products.map(p => ({
            project_id: p.project_id,
            product_id: p.product_id,
            area_version_id: newVersion.id,
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

        // Copy floor plan if source version has one
        if (sourceVersion.floor_plan_urn && sourceVersion.floor_plan_filename) {
          try {
            // Get project's OSS bucket
            const { data: areaWithProject } = await supabaseServer
              .schema('projects')
              .from('project_areas')
              .select('project_id, projects!inner(oss_bucket)')
              .eq('id', input.area_id)
              .single()

            const projectData = areaWithProject?.projects as unknown as { oss_bucket: string | null } | null
            const bucketName = projectData?.oss_bucket

            if (bucketName) {
              // Import APS service functions
              const {
                generateObjectKey,
                copyFloorPlanInBucket,
                translateToSVF2
              } = await import('../../planner/aps-planner-service')

              // Build source and target object keys
              const sourceObjectKey = generateObjectKey(
                input.area_id,
                sourceVersion.id,
                sourceVersion.floor_plan_filename
              )
              const targetObjectKey = generateObjectKey(
                input.area_id,
                newVersion.id,
                sourceVersion.floor_plan_filename
              )

              // Copy the DWG file in OSS bucket
              const { urn: newUrn } = await copyFloorPlanInBucket(
                bucketName,
                sourceObjectKey,
                targetObjectKey
              )

              // Start translation for the copied file
              await translateToSVF2(newUrn)

              // Update new version with floor plan info
              await supabaseServer
                .schema('projects')
                .from('project_area_versions')
                .update({
                  floor_plan_urn: newUrn,
                  floor_plan_filename: sourceVersion.floor_plan_filename,
                  floor_plan_hash: sourceVersion.floor_plan_hash
                })
                .eq('id', newVersion.id)

              console.log(`[Areas] Copied floor plan to new version ${newVersionNumber}`)
            }
          } catch (floorPlanError) {
            // Log but don't fail - floor plan copy is optional
            console.warn('Failed to copy floor plan to new version:', floorPlanError)
          }
        }
      }
    }

    // Update area's current_version
    await supabaseServer
      .schema('projects')
      .from('project_areas')
      .update({
        current_version: newVersionNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.area_id)

    return {
      success: true,
      data: {
        id: newVersion.id,
        version_number: newVersionNumber,
        google_drive_folder_id: driveFolderId
      }
    }
  } catch (error) {
    console.error('Create version error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// SET CURRENT VERSION
// ============================================================================

export async function setAreaCurrentVersionAction(
  areaId: string,
  versionNumber: number
): Promise<ActionResult> {
  try {
    // Verify version exists
    const { data: version, error: versionError } = await supabaseServer
      .schema('projects')
      .from('project_area_versions')
      .select('id')
      .eq('area_id', areaId)
      .eq('version_number', versionNumber)
      .single()

    if (versionError || !version) {
      return { success: false, error: 'Version not found' }
    }

    // Update current_version
    const { error } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .update({
        current_version: versionNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', areaId)

    if (error) {
      console.error('Set current version error:', error)
      return { success: false, error: 'Failed to set current version' }
    }

    return { success: true }
  } catch (error) {
    console.error('Set current version error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// GET ALL VERSIONS FOR AREA
// ============================================================================

export async function getAreaVersionsAction(
  areaId: string
): Promise<ActionResult<AreaVersion[]>> {
  try {
    const { data: versions, error } = await supabaseServer
      .schema('projects')
      .from('project_area_versions')
      .select('*')
      .eq('area_id', areaId)
      .order('version_number', { ascending: false })

    if (error) {
      console.error('Get versions error:', error)
      return { success: false, error: 'Failed to fetch versions' }
    }

    // Get product count and cost for each version
    const versionsWithSummary = await Promise.all(
      (versions || []).map(async (v) => {
        const { data: summary } = await supabaseServer
          .schema('projects')
          .rpc('get_area_version_summary', { p_area_version_id: v.id })
          .single()

        const typedSummary = summary as VersionSummary | null
        return {
          ...v,
          product_count: typedSummary?.product_count || 0,
          total_cost: typedSummary?.total_cost || 0
        }
      })
    )

    return { success: true, data: versionsWithSummary }
  } catch (error) {
    console.error('Get versions error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// DELETE VERSION (only if not current)
// ============================================================================

export async function deleteAreaVersionAction(
  areaVersionId: string
): Promise<ActionResult> {
  try {
    // Get version info including Drive folder ID
    const { data: version, error: versionError } = await supabaseServer
      .schema('projects')
      .from('project_area_versions')
      .select('area_id, version_number, google_drive_folder_id')
      .eq('id', areaVersionId)
      .single()

    if (versionError || !version) {
      return { success: false, error: 'Version not found' }
    }

    // Check if it's the current version
    const { data: area } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .select('current_version')
      .eq('id', version.area_id)
      .single()

    if (area && area.current_version === version.version_number) {
      return { success: false, error: 'Cannot delete the current active version' }
    }

    const driveFolderId = version.google_drive_folder_id

    // Delete the version (cascade will delete associated products)
    const { error } = await supabaseServer
      .schema('projects')
      .from('project_area_versions')
      .delete()
      .eq('id', areaVersionId)

    if (error) {
      console.error('Delete version error:', error)
      return { success: false, error: 'Failed to delete version' }
    }

    // Try to delete the Drive folder if it exists
    if (driveFolderId) {
      try {
        await deleteAreaVersionFolderAction(driveFolderId)
      } catch (driveError) {
        // Log but don't fail - manual cleanup may be needed
        console.warn('Failed to delete Drive folder for version:', driveError)
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete version error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
