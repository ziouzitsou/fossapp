'use server'

import { supabaseServer } from '../supabase-server'
import { validateProjectId } from './validation'
import {
  createAreaFolderAction,
  deleteAreaFolderAction,
  createAreaVersionFolderAction,
  deleteAreaVersionFolderAction
} from './project-drive'
import { deleteFloorPlanObject, generateObjectKey } from '../planner/aps-planner-service'

// ============================================================================
// TYPES - Re-exported from @fossapp/projects for backward compatibility
// ============================================================================

export type {
  ProjectArea,
  AreaVersion,
  AreaVersionSummary,
  CreateAreaInput,
  UpdateAreaInput,
  CreateVersionInput,
  UpdateVersionInput,
} from '@fossapp/projects/types/areas'

export type { ActionResult } from '@fossapp/projects'

// Import types for use in this file
import type {
  ProjectArea,
  AreaVersion,
  AreaVersionSummary,
  CreateAreaInput,
  UpdateAreaInput,
  CreateVersionInput,
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
              } = await import('../planner/aps-planner-service')

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

// ============================================================================
// DELETE FLOOR PLAN FROM AREA VERSION
// ============================================================================

/**
 * Remove floor plan from an area version
 *
 * This deletes both the database reference AND the OSS file.
 * If other versions need the file, use copyTo() when creating them.
 */
export async function deleteAreaVersionFloorPlanAction(
  areaVersionId: string
): Promise<ActionResult> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(areaVersionId)) {
      return { success: false, error: 'Invalid area version ID format' }
    }

    // Get the area version with its floor plan info and area details
    const { data: areaVersion, error: fetchError } = await supabaseServer
      .schema('projects')
      .from('project_area_versions')
      .select(`
        id,
        version_number,
        floor_plan_filename,
        floor_plan_urn,
        project_areas!inner (
          project_id,
          area_code
        )
      `)
      .eq('id', areaVersionId)
      .single()

    if (fetchError || !areaVersion) {
      console.error('Fetch area version error:', fetchError)
      return { success: false, error: 'Area version not found' }
    }

    // Delete from OSS if file exists
    if (areaVersion.floor_plan_filename && areaVersion.floor_plan_urn) {
      // Type assertion for nested join data (Supabase returns object for !inner with single())
      const projectAreas = areaVersion.project_areas as unknown as { project_id: string; area_code: string }
      const objectKey = generateObjectKey(
        projectAreas.area_code,
        areaVersion.version_number,
        areaVersion.floor_plan_filename
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
      .from('project_area_versions')
      .update({
        floor_plan_urn: null,
        floor_plan_filename: null,
        floor_plan_hash: null,
        floor_plan_status: null,
        floor_plan_thumbnail_urn: null,
        floor_plan_warnings: null,
        floor_plan_manifest: null
      })
      .eq('id', areaVersionId)

    if (error) {
      console.error('Delete floor plan error:', error)
      return { success: false, error: 'Failed to delete floor plan' }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete area version floor plan error:', error)
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
  worldX: number
  worldY: number
  rotation: number
}

/**
 * Load all placements for an area version
 */
export async function loadAreaPlacementsAction(
  areaVersionId: string
): Promise<ActionResult<PlacementData[]>> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(areaVersionId)) {
      return { success: false, error: 'Invalid area version ID format' }
    }

    const { data, error } = await supabaseServer
      .schema('projects')
      .rpc('get_area_placements', { p_area_version_id: areaVersionId })

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
      world_x: number
      world_y: number
      rotation: number
    }) => ({
      id: row.id,
      projectProductId: row.project_product_id,
      productId: row.product_id,
      productName: row.product_name,
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
 * Save all placements for an area version (atomic replace)
 * Deletes existing placements and inserts new ones in a transaction
 */
export async function saveAreaPlacementsAction(
  areaVersionId: string,
  placements: PlacementData[]
): Promise<ActionResult> {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(areaVersionId)) {
      return { success: false, error: 'Invalid area version ID format' }
    }

    // Call RPC function for atomic save
    const { error } = await supabaseServer
      .schema('projects')
      .rpc('save_area_placements', {
        p_area_version_id: areaVersionId,
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
