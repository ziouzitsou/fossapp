'use server'

import { supabaseServer } from '../supabase-server'
import { validateProjectId } from './validation'

// ============================================================================
// INTERFACES
// ============================================================================

export interface ProjectArea {
  id: string
  project_id: string
  area_code: string
  area_name: string
  area_name_en?: string
  area_type?: string
  floor_level?: number
  area_sqm?: number
  ceiling_height_m?: number
  current_version: number
  display_order: number
  is_active: boolean
  description?: string
  notes?: string
  created_at: string
  updated_at: string
  // Populated when fetching with version data
  current_version_data?: AreaVersionSummary
  all_versions?: AreaVersion[]
}

export interface AreaVersion {
  id: string
  area_id: string
  version_number: number
  version_name?: string
  notes?: string
  google_drive_folder_id?: string
  status: string
  approved_at?: string
  approved_by?: string
  created_at: string
  created_by?: string
  // Calculated fields
  product_count?: number
  total_cost?: number
}

export interface AreaVersionSummary {
  id: string
  version_number: number
  version_name?: string
  notes?: string
  created_at: string
  created_by?: string
  product_count: number
  total_cost: number
}

export interface CreateAreaInput {
  project_id: string
  area_code: string
  area_name: string
  area_name_en?: string
  area_type?: string
  floor_level?: number
  area_sqm?: number
  ceiling_height_m?: number
  display_order?: number
  description?: string
  notes?: string
  created_by?: string
}

export interface UpdateAreaInput {
  area_code?: string
  area_name?: string
  area_name_en?: string
  area_type?: string
  floor_level?: number
  area_sqm?: number
  ceiling_height_m?: number
  display_order?: number
  description?: string
  notes?: string
  is_active?: boolean
}

export interface CreateVersionInput {
  area_id: string
  copy_from_version?: number
  version_name?: string
  notes?: string
  created_by?: string
}

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
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

          if (summary) {
            productCount = summary.product_count || 0
            totalCost = summary.total_cost || 0
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
            total_cost: totalCost
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

                return {
                  ...v,
                  product_count: versionSummary?.product_count || 0,
                  total_cost: versionSummary?.total_cost || 0
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

      if (summary) {
        productCount = summary.product_count || 0
        totalCost = summary.total_cost || 0
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
): Promise<ActionResult<{ id: string; version_id: string }>> {
  try {
    const sanitizedProjectId = validateProjectId(input.project_id)

    // Validate required fields
    if (!input.area_code?.trim()) {
      return { success: false, error: 'Area code is required' }
    }
    if (!input.area_name?.trim()) {
      return { success: false, error: 'Area name is required' }
    }

    // Create the area (trigger will create initial version)
    const { data, error } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .insert({
        project_id: sanitizedProjectId,
        area_code: input.area_code.trim().toUpperCase(),
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

    return {
      success: true,
      data: {
        id: data.id,
        version_id: version?.id || ''
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
    const { error } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .delete()
      .eq('id', areaId)

    if (error) {
      console.error('Delete area error:', error)
      return { success: false, error: 'Failed to delete area' }
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
): Promise<ActionResult<{ id: string; version_number: number }>> {
  try {
    // Get the area to find next version number
    const { data: area, error: areaError } = await supabaseServer
      .schema('projects')
      .from('project_areas')
      .select('current_version')
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

    // If copy_from_version is specified, copy products
    if (input.copy_from_version) {
      const { data: sourceVersion } = await supabaseServer
        .schema('projects')
        .from('project_area_versions')
        .select('id')
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
        version_number: newVersionNumber
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

        return {
          ...v,
          product_count: summary?.product_count || 0,
          total_cost: summary?.total_cost || 0
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
    // Get version info
    const { data: version, error: versionError } = await supabaseServer
      .schema('projects')
      .from('project_area_versions')
      .select('area_id, version_number')
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

    return { success: true }
  } catch (error) {
    console.error('Delete version error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
