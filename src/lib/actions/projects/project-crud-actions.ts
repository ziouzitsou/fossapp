'use server'

/**
 * Project CRUD Actions
 *
 * Core server actions for managing lighting design projects.
 * Projects are the top-level containers that organize:
 * - Customer information
 * - Project areas (rooms/zones)
 * - Product selections
 * - Documents and contacts
 * - Google Drive integration
 * - APS floor plan storage (OSS buckets)
 *
 * @remarks
 * All functions validate input and use the service-role Supabase client.
 * Returns `ActionResult<T>` for consistent error handling in the UI.
 *
 * @module actions/projects/project-crud-actions
 */

import { supabaseServer } from '@fossapp/core/db/server'
import { validateProjectId } from '@fossapp/core/validation'
import { getGoogleDriveProjectService } from '../../google-drive-project-service'

import type {
  ProjectListItem,
  ProjectProduct,
  ProjectDetail,
  ProjectListParams,
  ProjectListResult,
  CreateProjectInput,
  UpdateProjectInput,
  ActionResult,
} from '@fossapp/projects'

// ============================================================================
// LIST PROJECTS
// ============================================================================

/**
 * List projects with pagination and sorting
 *
 * @remarks
 * Fetches projects from the `projects.projects` table with related customer names.
 * Returns a paginated result for efficient display in data tables.
 *
 * @param params - Pagination and sorting options
 * @param params.page - Page number (1-based, default: 1)
 * @param params.pageSize - Items per page (default: 10)
 * @param params.sortBy - Column to sort by (default: 'created_at')
 * @param params.sortOrder - Sort direction ('asc' | 'desc', default: 'desc')
 * @returns Paginated list of projects with customer names joined
 */
export async function listProjectsAction(params: ProjectListParams = {}): Promise<ProjectListResult> {
  const {
    page = 1,
    pageSize = 10,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = params

  try {
    // Get total count
    const { count, error: countError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Count error:', countError)
      return {
        projects: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0
      }
    }

    // Calculate pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Fetch projects with pagination
    const { data: projects, error: projectsError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select(`
        id,
        project_code,
        name,
        name_en,
        city,
        project_type,
        status,
        priority,
        estimated_budget,
        currency,
        start_date,
        expected_completion_date,
        created_at,
        customer_id,
        google_drive_folder_id,
        is_archived
      `)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to)

    if (projectsError) {
      console.error('List projects error:', projectsError)
      return {
        projects: [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    }

    // Fetch customer names for projects with customer_id
    const customerIds = projects
      ?.map(p => p.customer_id)
      .filter((id): id is string => id != null) || []

    let customerMap = new Map<string, { name: string; name_en?: string }>()

    if (customerIds.length > 0) {
      const { data: customers, error: customersError } = await supabaseServer
        .schema('customers')
        .from('customers')
        .select('id, name, name_en')
        .in('id', customerIds)

      if (customersError) {
        console.error('Get customers error:', customersError)
      } else if (customers) {
        customerMap = new Map(
          customers.map(c => [c.id, { name: c.name, name_en: c.name_en }])
        )
      }
    }

    // Map projects with customer names
    const projectsWithCustomers = (projects || []).map(project => {
      const customer = project.customer_id ? customerMap.get(project.customer_id) : null
      return {
        id: project.id,
        project_code: project.project_code,
        name: project.name,
        name_en: project.name_en,
        customer_name: customer?.name,
        customer_name_en: customer?.name_en,
        city: project.city,
        project_type: project.project_type,
        status: project.status,
        priority: project.priority,
        estimated_budget: project.estimated_budget,
        currency: project.currency,
        start_date: project.start_date,
        expected_completion_date: project.expected_completion_date,
        created_at: project.created_at,
        google_drive_folder_id: project.google_drive_folder_id,
        is_archived: project.is_archived ?? false
      }
    })

    return {
      projects: projectsWithCustomers,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    }
  } catch (error) {
    console.error('List projects error:', error)
    return {
      projects: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0
    }
  }
}

// ============================================================================
// GET PROJECT BY ID
// ============================================================================

/**
 * Get full project details by ID
 *
 * @remarks
 * Fetches a complete project with all related data:
 * - Customer details (name, email, phone)
 * - Products with area assignments
 * - Contacts (primary contact first)
 * - Documents (newest first)
 * - Phases and Areas
 *
 * Used on the project detail page to display all project information.
 *
 * @param projectId - UUID of the project
 * @returns Full project details or null if not found
 */
export async function getProjectByIdAction(projectId: string): Promise<ProjectDetail | null> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    // Get project details
    const { data: project, error: projectError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select('*')
      .eq('id', sanitizedProjectId)
      .single()

    if (projectError || !project) {
      console.error('Get project error:', projectError)
      return null
    }

    // Fetch customer separately if customer_id exists
    let customer = null
    if (project.customer_id) {
      const { data: customerData, error: customerError } = await supabaseServer
        .schema('customers')
        .from('customers')
        .select('id, name, name_en, email, phone')
        .eq('id', project.customer_id)
        .single()

      if (customerError) {
        console.error('Get customer error:', customerError)
      } else {
        customer = customerData
      }
    }

    // Get project products with area info
    const { data: projectProducts, error: productsError } = await supabaseServer
      .schema('projects')
      .from('project_products')
      .select(`
        id,
        product_id,
        quantity,
        unit_price,
        discount_percent,
        total_price,
        room_location,
        mounting_height,
        status,
        notes,
        area_revision_id,
        project_area_revisions!inner (
          id,
          revision_number,
          project_areas!inner (
            id,
            area_code,
            area_name,
            floor_level,
            display_order
          )
        )
      `)
      .eq('project_id', sanitizedProjectId)
      .order('room_location')

    if (productsError) {
      console.error('Get project products error:', productsError)
    }

    // Fetch product details separately if we have products
    const products: ProjectProduct[] = []
    if (projectProducts && projectProducts.length > 0) {
      const productIds = projectProducts.map(p => p.product_id)

      const { data: productDetails, error: productDetailsError } = await supabaseServer
        .schema('items')
        .from('product_info')
        .select('product_id, foss_pid, description_short')
        .in('product_id', productIds)

      if (productDetailsError) {
        console.error('Get product details error:', productDetailsError)
      }

      // Create a map of product details by ID
      const productMap = new Map(
        (productDetails || []).map(p => [p.product_id, p])
      )

      // Combine project products with product details and area info
      for (const pp of projectProducts) {
        const productDetail = productMap.get(pp.product_id)
        // Extract area info from joined data (it's a single object due to !inner join on FK)
        const areaRevisionData = pp.project_area_revisions as unknown as {
          id: string
          revision_number: number
          project_areas: {
            id: string
            area_code: string
            area_name: string
            floor_level: number | null
            display_order: number
          }
        } | null

        products.push({
          id: pp.id,
          product_id: pp.product_id,
          quantity: pp.quantity,
          unit_price: pp.unit_price,
          discount_percent: pp.discount_percent,
          total_price: pp.total_price,
          room_location: pp.room_location,
          mounting_height: pp.mounting_height,
          status: pp.status,
          notes: pp.notes,
          foss_pid: productDetail?.foss_pid || '',
          description_short: productDetail?.description_short || '',
          area_revision_id: pp.area_revision_id,
          area_code: areaRevisionData?.project_areas?.area_code,
          area_name: areaRevisionData?.project_areas?.area_name,
          area_revision_number: areaRevisionData?.revision_number,
        })
      }
    }

    // Get contacts
    const { data: contacts, error: contactsError } = await supabaseServer
      .schema('projects')
      .from('project_contacts')
      .select('*')
      .eq('project_id', sanitizedProjectId)
      .order('is_primary', { ascending: false })

    if (contactsError) {
      console.error('Get project contacts error:', contactsError)
    }

    // Get documents
    const { data: documents, error: documentsError } = await supabaseServer
      .schema('projects')
      .from('project_documents')
      .select('*')
      .eq('project_id', sanitizedProjectId)
      .order('created_at', { ascending: false })

    if (documentsError) {
      console.error('Get project documents error:', documentsError)
    }

    // Get phases
    const { data: phases, error: phasesError } = await supabaseServer
      .schema('projects')
      .from('project_phases')
      .select('*')
      .eq('project_id', sanitizedProjectId)
      .order('phase_number')

    if (phasesError) {
      console.error('Get project phases error:', phasesError)
    }

    // Get project areas (using the listProjectAreasAction from areas)
    const { listProjectAreasAction } = await import('../areas')
    const areasResult = await listProjectAreasAction(sanitizedProjectId, true)
    const areas = areasResult.success ? areasResult.data || [] : []

    return {
      id: project.id,
      project_code: project.project_code,
      name: project.name,
      name_en: project.name_en,
      description: project.description,
      customer_id: project.customer_id,
      customer_name: customer?.name,
      customer_name_en: customer?.name_en,
      customer_email: customer?.email,
      customer_phone: customer?.phone,
      street_address: project.street_address,
      postal_code: project.postal_code,
      city: project.city,
      region: project.region,
      prefecture: project.prefecture,
      country: project.country,
      latitude: project.latitude,
      longitude: project.longitude,
      project_type: project.project_type,
      project_category: project.project_category,
      building_area_sqm: project.building_area_sqm,
      estimated_budget: project.estimated_budget,
      currency: project.currency,
      status: project.status,
      priority: project.priority,
      start_date: project.start_date,
      expected_completion_date: project.expected_completion_date,
      actual_completion_date: project.actual_completion_date,
      project_manager: project.project_manager,
      architect_firm: project.architect_firm,
      electrical_engineer: project.electrical_engineer,
      lighting_designer: project.lighting_designer,
      notes: project.notes,
      tags: project.tags,
      created_at: project.created_at,
      updated_at: project.updated_at,
      created_by: project.created_by,
      // Google Drive integration fields
      google_drive_folder_id: project.google_drive_folder_id,
      is_archived: project.is_archived ?? false,
      // Related data
      products: products,
      contacts: contacts || [],
      documents: documents || [],
      phases: phases || [],
      areas: areas,
    }
  } catch (error) {
    console.error('Get project by ID error:', error)
    return null
  }
}

// ============================================================================
// CREATE PROJECT
// ============================================================================

/**
 * Create a new project
 *
 * @remarks
 * Creates a project record and provisions cloud storage:
 * 1. Validates required fields (project_code, name)
 * 2. Inserts project record with defaults (EUR, draft status, medium priority)
 * 3. Creates APS OSS bucket for floor plan storage (Planner feature)
 *
 * The OSS bucket is created upfront since all projects use the Planner.
 * Google Drive folder is created separately when user enables integration.
 *
 * @param input - Project creation data
 * @returns Success with project ID, or error message
 */
export async function createProjectAction(
  input: CreateProjectInput
): Promise<ActionResult<{ id: string }>> {
  try {
    // Validate required fields
    if (!input.project_code?.trim()) {
      return { success: false, error: 'Project code is required' }
    }
    if (!input.name?.trim()) {
      return { success: false, error: 'Project name is required' }
    }

    const { data, error } = await supabaseServer
      .schema('projects')
      .from('projects')
      .insert({
        project_code: input.project_code.trim(),
        name: input.name.trim(),
        name_en: input.name_en?.trim() || null,
        description: input.description?.trim() || null,
        customer_id: input.customer_id || null,
        street_address: input.street_address?.trim() || null,
        postal_code: input.postal_code?.trim() || null,
        city: input.city?.trim() || null,
        region: input.region?.trim() || null,
        prefecture: input.prefecture?.trim() || null,
        country: input.country?.trim() || 'Greece',
        project_type: input.project_type || null,
        project_category: input.project_category || null,
        building_area_sqm: input.building_area_sqm || null,
        estimated_budget: input.estimated_budget || null,
        currency: input.currency || 'EUR',
        status: input.status || 'draft',
        priority: input.priority || 'medium',
        start_date: input.start_date || null,
        expected_completion_date: input.expected_completion_date || null,
        project_manager: input.project_manager?.trim() || null,
        architect_firm: input.architect_firm?.trim() || null,
        electrical_engineer: input.electrical_engineer?.trim() || null,
        lighting_designer: input.lighting_designer?.trim() || null,
        notes: input.notes?.trim() || null,
        tags: input.tags || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Create project error:', error)
      if (error.code === '23505') {
        return { success: false, error: 'A project with this code already exists' }
      }
      return { success: false, error: 'Failed to create project' }
    }

    // Create OSS bucket for floor plans (Planner feature)
    // Bucket is created upfront since all projects will use Planner
    // Also upload FOSS.dwt template to bucket for DA processing
    //
    // ROBUSTNESS: Even if this fails, floor plan upload will check for
    // the template and upload it on-demand (see design-automation-service.ts)
    try {
      const { ensureProjectBucketExists, uploadTemplateToProjectBucket } = await import('../../planner/aps-planner-service')
      const { getGoogleDriveTemplateService } = await import('../../planner/google-drive-template-service')

      console.log(`[Project] Creating OSS bucket for project ${data.id}...`)
      const bucketName = await ensureProjectBucketExists(data.id)

      // Fetch FOSS.dwt from Google Drive (with retry) and upload to bucket
      console.log(`[Project] Uploading FOSS.dwt template to ${bucketName}...`)
      const templateService = getGoogleDriveTemplateService()
      const templateBuffer = await templateService.fetchFossTemplate()
      await uploadTemplateToProjectBucket(bucketName, templateBuffer)

      // Update project with bucket name
      await supabaseServer
        .schema('projects')
        .from('projects')
        .update({
          oss_bucket: bucketName,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.id)

      console.log(`[Project] ✓ OSS bucket ready: ${bucketName} (template: ${(templateBuffer.length / 1024).toFixed(0)} KB)`)
    } catch (ossError) {
      // Log warning but don't block project creation
      // The template will be uploaded on-demand during first floor plan upload
      console.warn(`[Project] ⚠ OSS bucket/template setup failed (will retry on first upload):`, ossError)
    }

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Create project error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// UPDATE PROJECT
// ============================================================================

/**
 * Update an existing project
 *
 * @remarks
 * Supports partial updates - only fields present in input are modified.
 * Empty strings are converted to null for optional fields.
 * Required fields (project_code, name) cannot be emptied.
 *
 * @param projectId - UUID of the project to update
 * @param input - Fields to update (undefined values are ignored)
 * @returns Success with project ID, or error message
 */
export async function updateProjectAction(
  projectId: string,
  input: UpdateProjectInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    // Build update object, only including non-undefined values
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (input.project_code !== undefined) {
      if (!input.project_code.trim()) {
        return { success: false, error: 'Project code cannot be empty' }
      }
      updateData.project_code = input.project_code.trim()
    }
    if (input.name !== undefined) {
      if (!input.name.trim()) {
        return { success: false, error: 'Project name cannot be empty' }
      }
      updateData.name = input.name.trim()
    }
    if (input.name_en !== undefined) updateData.name_en = input.name_en?.trim() || null
    if (input.description !== undefined) updateData.description = input.description?.trim() || null
    if (input.customer_id !== undefined) updateData.customer_id = input.customer_id || null
    if (input.street_address !== undefined) updateData.street_address = input.street_address?.trim() || null
    if (input.postal_code !== undefined) updateData.postal_code = input.postal_code?.trim() || null
    if (input.city !== undefined) updateData.city = input.city?.trim() || null
    if (input.region !== undefined) updateData.region = input.region?.trim() || null
    if (input.prefecture !== undefined) updateData.prefecture = input.prefecture?.trim() || null
    if (input.country !== undefined) updateData.country = input.country?.trim() || null
    if (input.project_type !== undefined) updateData.project_type = input.project_type || null
    if (input.project_category !== undefined) updateData.project_category = input.project_category || null
    if (input.building_area_sqm !== undefined) updateData.building_area_sqm = input.building_area_sqm || null
    if (input.estimated_budget !== undefined) updateData.estimated_budget = input.estimated_budget || null
    if (input.currency !== undefined) updateData.currency = input.currency || 'EUR'
    if (input.status !== undefined) updateData.status = input.status || 'draft'
    if (input.priority !== undefined) updateData.priority = input.priority || 'medium'
    if (input.start_date !== undefined) updateData.start_date = input.start_date || null
    if (input.expected_completion_date !== undefined) updateData.expected_completion_date = input.expected_completion_date || null
    if (input.actual_completion_date !== undefined) updateData.actual_completion_date = input.actual_completion_date || null
    if (input.project_manager !== undefined) updateData.project_manager = input.project_manager?.trim() || null
    if (input.architect_firm !== undefined) updateData.architect_firm = input.architect_firm?.trim() || null
    if (input.electrical_engineer !== undefined) updateData.electrical_engineer = input.electrical_engineer?.trim() || null
    if (input.lighting_designer !== undefined) updateData.lighting_designer = input.lighting_designer?.trim() || null
    if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null
    if (input.tags !== undefined) updateData.tags = input.tags || null

    const { data, error } = await supabaseServer
      .schema('projects')
      .from('projects')
      .update(updateData)
      .eq('id', sanitizedProjectId)
      .select('id')
      .single()

    if (error) {
      console.error('Update project error:', error)
      if (error.code === '23505') {
        return { success: false, error: 'A project with this code already exists' }
      }
      return { success: false, error: 'Failed to update project' }
    }

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Update project error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// DELETE PROJECT
// ============================================================================

/**
 * Delete a project and all associated resources
 *
 * @remarks
 * **Destructive operation** - permanently deletes:
 * 1. Google Drive folder (if linked)
 * 2. APS OSS bucket with floor plans
 * 3. Project areas (cascade deletes revisions and products)
 * 4. Project products, contacts, documents, phases
 * 5. The project record itself
 *
 * Cloud resource deletion failures are logged but don't block DB deletion.
 * This prevents orphaned cloud resources from blocking project removal.
 *
 * @param projectId - UUID of the project to delete
 * @returns Success or error message
 */
export async function deleteProjectAction(
  projectId: string
): Promise<ActionResult> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    // 1. Get the project's Google Drive folder ID and OSS bucket before deleting
    const { data: project } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select('google_drive_folder_id, oss_bucket')
      .eq('id', sanitizedProjectId)
      .single()

    // 2. Delete Google Drive folder if it exists
    if (project?.google_drive_folder_id) {
      try {
        const driveService = getGoogleDriveProjectService()
        await driveService.deleteProject(project.google_drive_folder_id)
      } catch (driveError) {
        console.error('Delete Google Drive folder error:', driveError)
        // Continue with database deletion even if Drive deletion fails
      }
    }

    // 3. Delete APS OSS bucket if it exists (for planner floor plans)
    if (project?.oss_bucket) {
      try {
        const { deleteProjectBucket } = await import('../../planner/aps-planner-service')
        await deleteProjectBucket(sanitizedProjectId)
      } catch (ossError) {
        console.error('Delete OSS bucket error:', ossError)
        // Continue with database deletion even if OSS deletion fails
      }
    }

    // 4. Delete related records (due to foreign key constraints)
    // Delete project areas (cascade deletes area_versions and linked products)
    await supabaseServer
      .schema('projects')
      .from('project_areas')
      .delete()
      .eq('project_id', sanitizedProjectId)

    // Delete project products
    await supabaseServer
      .schema('projects')
      .from('project_products')
      .delete()
      .eq('project_id', sanitizedProjectId)

    // Delete project contacts
    await supabaseServer
      .schema('projects')
      .from('project_contacts')
      .delete()
      .eq('project_id', sanitizedProjectId)

    // Delete project documents
    await supabaseServer
      .schema('projects')
      .from('project_documents')
      .delete()
      .eq('project_id', sanitizedProjectId)

    // Delete project phases
    await supabaseServer
      .schema('projects')
      .from('project_phases')
      .delete()
      .eq('project_id', sanitizedProjectId)

    // 5. Delete the project
    const { error } = await supabaseServer
      .schema('projects')
      .from('projects')
      .delete()
      .eq('id', sanitizedProjectId)

    if (error) {
      console.error('Delete project error:', error)
      return { success: false, error: 'Failed to delete project' }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete project error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
