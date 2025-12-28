'use server'

/**
 * Area CRUD Actions
 *
 * Core operations for project areas: list, get, create, update, delete.
 * Areas represent physical spaces within a project (rooms, floors, zones).
 */

import { supabaseServer } from '@fossapp/core/db/server'
import { validateProjectId } from '@fossapp/core/validation'
import {
  createAreaFolderAction,
  deleteAreaFolderAction,
} from '../project-drive'

import type {
  ProjectArea,
  AreaVersion,
  CreateAreaInput,
  UpdateAreaInput,
  ActionResult,
} from '@fossapp/projects'

// Type for the RPC function return
type VersionSummary = {
  product_count: number
  total_cost: number
}

// ============================================================================
// LIST AREAS FOR PROJECT
// ============================================================================

export async function listProjectAreasAction(
  projectId: string,
  includeVersions = false
): Promise<ActionResult<ProjectArea[]>> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    // Fetch areas
    const { data: areas, error: areasError } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .select('*')
      .eq('project_id', sanitizedProjectId)
      .eq('is_active', true)
      .order('display_order')
      .order('floor_level', { ascending: true, nullsFirst: false })

    if (areasError) {
      console.error('List areas error:', areasError)
      return { success: false, error: 'Failed to fetch areas' }
    }

    if (!areas || areas.length === 0) {
      return { success: true, data: [] }
    }

    // Fetch current version data for each area
    const areasWithVersions: ProjectArea[] = await Promise.all(
      areas.map(async (area) => {
        // Get current version data
        const { data: currentVersion } = await supabaseServer
          .schema('projects')
          .from('project_area_versions')
          .select('*')
          .eq('area_id', area.id)
          .eq('version_number', area.current_version)
          .single()

        // Get product count and total cost for current version
        let productCount = 0
        let totalCost = 0
        if (currentVersion) {
          const { data: summary } = await supabaseServer
            .schema('projects')
            .rpc('get_area_version_summary', { p_area_version_id: currentVersion.id })
            .single()

          const typedSummary = summary as VersionSummary | null
          if (typedSummary) {
            productCount = typedSummary.product_count || 0
            totalCost = typedSummary.total_cost || 0
          }
        }

        const areaData: ProjectArea = {
          ...area,
          current_version_data: currentVersion ? {
            id: currentVersion.id,
            version_number: currentVersion.version_number,
            version_name: currentVersion.version_name,
            notes: currentVersion.notes,
            created_at: currentVersion.created_at,
            created_by: currentVersion.created_by,
            product_count: productCount,
            total_cost: totalCost,
            floor_plan_urn: currentVersion.floor_plan_urn,
            floor_plan_filename: currentVersion.floor_plan_filename,
            floor_plan_status: currentVersion.floor_plan_status,
            floor_plan_warnings: currentVersion.floor_plan_warnings
          } : undefined
        }

        // Optionally fetch all versions
        if (includeVersions) {
          const { data: versions } = await supabaseServer
            .schema('projects')
            .from('project_area_versions')
            .select('*')
            .eq('area_id', area.id)
            .order('version_number', { ascending: false })

          if (versions) {
            areaData.all_versions = await Promise.all(
              versions.map(async (v) => {
                const { data: versionSummary } = await supabaseServer
                  .schema('projects')
                  .rpc('get_area_version_summary', { p_area_version_id: v.id })
                  .single()

                const typedSummary = versionSummary as VersionSummary | null
                return {
                  ...v,
                  product_count: typedSummary?.product_count || 0,
                  total_cost: typedSummary?.total_cost || 0
                }
              })
            )
          }
        }

        return areaData
      })
    )

    return { success: true, data: areasWithVersions }
  } catch (error) {
    console.error('List areas error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// GET AREA BY ID
// ============================================================================

export async function getAreaByIdAction(areaId: string): Promise<ActionResult<ProjectArea>> {
  try {
    const { data: area, error } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .select('*')
      .eq('id', areaId)
      .single()

    if (error || !area) {
      console.error('Get area error:', error)
      return { success: false, error: 'Area not found' }
    }

    // Get current version data
    const { data: currentVersion } = await supabaseServer
      .schema('projects')
      .from('project_area_versions')
      .select('*')
      .eq('area_id', area.id)
      .eq('version_number', area.current_version)
      .single()

    // Get product summary
    let productCount = 0
    let totalCost = 0
    if (currentVersion) {
      const { data: summary } = await supabaseServer
        .schema('projects')
        .rpc('get_area_version_summary', { p_area_version_id: currentVersion.id })
        .single()

      const typedSummary = summary as VersionSummary | null
      if (typedSummary) {
        productCount = typedSummary.product_count || 0
        totalCost = typedSummary.total_cost || 0
      }
    }

    return {
      success: true,
      data: {
        ...area,
        current_version_data: currentVersion ? {
          id: currentVersion.id,
          version_number: currentVersion.version_number,
          version_name: currentVersion.version_name,
          notes: currentVersion.notes,
          created_at: currentVersion.created_at,
          created_by: currentVersion.created_by,
          product_count: productCount,
          total_cost: totalCost
        } : undefined
      }
    }
  } catch (error) {
    console.error('Get area error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// CREATE AREA
// ============================================================================

export async function createAreaAction(
  input: CreateAreaInput
): Promise<ActionResult<{ id: string; version_id: string; google_drive_folder_id?: string }>> {
  try {
    const sanitizedProjectId = validateProjectId(input.project_id)

    // Validate required fields
    if (!input.area_code?.trim()) {
      return { success: false, error: 'Area code is required' }
    }
    if (!input.area_name?.trim()) {
      return { success: false, error: 'Area name is required' }
    }

    const areaCode = input.area_code.trim().toUpperCase()

    // Create the area (trigger will create initial version)
    const { data, error } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .insert({
        project_id: sanitizedProjectId,
        area_code: areaCode,
        area_name: input.area_name.trim(),
        area_name_en: input.area_name_en?.trim() || null,
        area_type: input.area_type || null,
        floor_level: input.floor_level ?? null,
        area_sqm: input.area_sqm ?? null,
        ceiling_height_m: input.ceiling_height_m ?? null,
        display_order: input.display_order ?? 0,
        description: input.description?.trim() || null,
        notes: input.created_by || null  // Store creator in notes for trigger
      })
      .select('id')
      .single()

    if (error) {
      console.error('Create area error:', error)
      if (error.code === '23505') {
        return { success: false, error: 'An area with this code already exists in this project' }
      }
      return { success: false, error: 'Failed to create area' }
    }

    // Get the auto-created version
    const { data: version } = await supabaseServer
      .schema('projects')
      .from('project_area_versions')
      .select('id')
      .eq('area_id', data.id)
      .eq('version_number', 1)
      .single()

    // Try to create Google Drive folder for this area
    let driveFolderId: string | undefined
    let versionFolderId: string | undefined
    try {
      const driveResult = await createAreaFolderAction(sanitizedProjectId, areaCode)
      if (driveResult.success && driveResult.data) {
        driveFolderId = driveResult.data.areaFolderId
        versionFolderId = driveResult.data.versionFolderId

        // Update area with Drive folder ID
        await supabaseServer
          .schema('projects')
          .from('project_areas')
          .update({ google_drive_folder_id: driveFolderId })
          .eq('id', data.id)

        // Update v1 version with its Drive folder ID
        if (version?.id && versionFolderId) {
          await supabaseServer
            .schema('projects')
            .from('project_area_versions')
            .update({ google_drive_folder_id: versionFolderId })
            .eq('id', version.id)
        }
      }
    } catch (driveError) {
      // Log but don't fail - Drive folder is optional
      console.warn('Failed to create Drive folder for area:', driveError)
    }

    return {
      success: true,
      data: {
        id: data.id,
        version_id: version?.id || '',
        google_drive_folder_id: driveFolderId
      }
    }
  } catch (error) {
    console.error('Create area error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// UPDATE AREA
// ============================================================================

export async function updateAreaAction(
  areaId: string,
  input: UpdateAreaInput
): Promise<ActionResult> {
  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (input.area_code !== undefined) {
      if (!input.area_code.trim()) {
        return { success: false, error: 'Area code cannot be empty' }
      }
      updateData.area_code = input.area_code.trim().toUpperCase()
    }
    if (input.area_name !== undefined) {
      if (!input.area_name.trim()) {
        return { success: false, error: 'Area name cannot be empty' }
      }
      updateData.area_name = input.area_name.trim()
    }
    if (input.area_name_en !== undefined) updateData.area_name_en = input.area_name_en?.trim() || null
    if (input.area_type !== undefined) updateData.area_type = input.area_type || null
    if (input.floor_level !== undefined) updateData.floor_level = input.floor_level ?? null
    if (input.area_sqm !== undefined) updateData.area_sqm = input.area_sqm ?? null
    if (input.ceiling_height_m !== undefined) updateData.ceiling_height_m = input.ceiling_height_m ?? null
    if (input.display_order !== undefined) updateData.display_order = input.display_order
    if (input.description !== undefined) updateData.description = input.description?.trim() || null
    if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null
    if (input.is_active !== undefined) updateData.is_active = input.is_active

    const { error } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .update(updateData)
      .eq('id', areaId)

    if (error) {
      console.error('Update area error:', error)
      if (error.code === '23505') {
        return { success: false, error: 'An area with this code already exists in this project' }
      }
      return { success: false, error: 'Failed to update area' }
    }

    return { success: true }
  } catch (error) {
    console.error('Update area error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// DELETE AREA
// ============================================================================

export async function deleteAreaAction(areaId: string): Promise<ActionResult> {
  try {
    // Get the area's Drive folder ID before deleting
    const { data: area } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .select('google_drive_folder_id')
      .eq('id', areaId)
      .single()

    const driveFolderId = area?.google_drive_folder_id

    // Delete the area from DB (cascade deletes versions, products)
    const { error } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .delete()
      .eq('id', areaId)

    if (error) {
      console.error('Delete area error:', error)
      return { success: false, error: 'Failed to delete area' }
    }

    // Try to delete the Drive folder if it exists
    if (driveFolderId) {
      try {
        await deleteAreaFolderAction(driveFolderId)
      } catch (driveError) {
        // Log but don't fail - manual cleanup may be needed
        console.warn('Failed to delete Drive folder for area:', driveError)
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete area error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
