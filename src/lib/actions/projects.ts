'use server'

import { supabaseServer } from '../supabase-server'
import { validateProjectId } from './validation'
import { getGoogleDriveProjectService } from '../google-drive-project-service'

// ============================================================================
// INTERFACES
// ============================================================================

export interface ProjectListItem {
  id: string
  project_code: string
  name: string
  name_en?: string
  customer_name?: string
  customer_name_en?: string
  city?: string
  project_type?: string
  status: string
  priority: string
  estimated_budget?: number
  currency?: string
  start_date?: string
  expected_completion_date?: string
  created_at: string
  // Google Drive integration fields
  google_drive_folder_id?: string
  current_version: number
  is_archived: boolean
}

export interface ProjectVersion {
  id: string
  project_id: string
  version_number: number
  google_drive_folder_id?: string
  created_at: string
  created_by?: string
  notes?: string
}

export interface ProjectProduct {
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
  // Area version information (for multi-area projects)
  area_version_id?: string
  area_code?: string
  area_name?: string
  area_version_number?: number
}

export interface ProjectContact {
  id: string
  contact_type: string
  name: string
  company?: string
  email?: string
  phone?: string
  mobile?: string
  role?: string
  is_primary: boolean
  notes?: string
}

export interface ProjectDocument {
  id: string
  document_type: string
  title: string
  description?: string
  file_path?: string
  file_url?: string
  mime_type?: string
  file_size_bytes?: number
  version: string
  is_latest: boolean
  created_at: string
  created_by?: string
}

export interface ProjectPhase {
  id: string
  phase_number: number
  phase_name: string
  description?: string
  budget?: number
  status: string
  start_date?: string
  end_date?: string
}

export interface ProjectDetail {
  id: string
  project_code: string
  name: string
  name_en?: string
  description?: string
  customer_id?: string
  customer_name?: string
  customer_name_en?: string
  customer_email?: string
  customer_phone?: string
  street_address?: string
  postal_code?: string
  city?: string
  region?: string
  prefecture?: string
  country?: string
  latitude?: number
  longitude?: number
  project_type?: string
  project_category?: string
  building_area_sqm?: number
  estimated_budget?: number
  currency?: string
  status: string
  priority: string
  start_date?: string
  expected_completion_date?: string
  actual_completion_date?: string
  project_manager?: string
  architect_firm?: string
  electrical_engineer?: string
  lighting_designer?: string
  notes?: string
  tags?: string[]
  created_at: string
  updated_at: string
  created_by?: string
  // Google Drive integration fields
  google_drive_folder_id?: string
  current_version: number
  is_archived: boolean
  // Related data
  products: ProjectProduct[]
  contacts: ProjectContact[]
  documents: ProjectDocument[]
  phases: ProjectPhase[]
  versions: ProjectVersion[]
  areas: ProjectArea[]  // NEW: Multi-area support
}

// Import ProjectArea type (will be added)
import type { ProjectArea } from './project-areas'

export interface ProjectListParams {
  page?: number
  pageSize?: number
  sortBy?: 'created_at' | 'project_code' | 'name' | 'status'
  sortOrder?: 'asc' | 'desc'
}

export interface ProjectListResult {
  projects: ProjectListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============================================================================
// LIST PROJECTS
// ============================================================================

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
        current_version,
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
        current_version: project.current_version ?? 1,
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
// CREATE PROJECT INPUT
// ============================================================================

export interface CreateProjectInput {
  project_code: string
  name: string
  name_en?: string
  description?: string
  customer_id?: string
  street_address?: string
  postal_code?: string
  city?: string
  region?: string
  prefecture?: string
  country?: string
  project_type?: string
  project_category?: string
  building_area_sqm?: number
  estimated_budget?: number
  currency?: string
  status?: string
  priority?: string
  start_date?: string
  expected_completion_date?: string
  project_manager?: string
  architect_firm?: string
  electrical_engineer?: string
  lighting_designer?: string
  notes?: string
  tags?: string[]
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  actual_completion_date?: string
}

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// CREATE PROJECT
// ============================================================================

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

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Create project error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// UPDATE PROJECT
// ============================================================================

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

export async function deleteProjectAction(
  projectId: string
): Promise<ActionResult> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    // 1. Get the project's Google Drive folder ID before deleting
    const { data: project } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select('google_drive_folder_id')
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

    // 3. Delete related records (due to foreign key constraints)
    // Delete project versions
    await supabaseServer
      .schema('projects')
      .from('project_versions')
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

    // 4. Delete the project
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

// ============================================================================
// GET PROJECT BY ID
// ============================================================================

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

    // Get project products
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
        notes
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

      // Combine project products with product details
      for (const pp of projectProducts) {
        const productDetail = productMap.get(pp.product_id)
        products.push({
          ...pp,
          foss_pid: productDetail?.foss_pid || '',
          description_short: productDetail?.description_short || ''
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

    // Get versions
    const { data: versions, error: versionsError } = await supabaseServer
      .schema('projects')
      .from('project_versions')
      .select('*')
      .eq('project_id', sanitizedProjectId)
      .order('version_number', { ascending: false })

    if (versionsError) {
      console.error('Get project versions error:', versionsError)
    }

    // Get project areas (using the listProjectAreasAction from project-areas.ts)
    const { listProjectAreasAction } = await import('./project-areas')
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
      current_version: project.current_version ?? 1,
      is_archived: project.is_archived ?? false,
      // Related data
      products: products,
      contacts: contacts || [],
      documents: documents || [],
      phases: phases || [],
      versions: versions || [],
      areas: areas,
    }
  } catch (error) {
    console.error('Get project by ID error:', error)
    return null
  }
}

// ============================================================================
// GENERATE PROJECT CODE
// ============================================================================

/**
 * Generate the next project code using the database function
 * Format: YYMM-NNN (e.g., 2512-001)
 */
export async function generateProjectCodeAction(): Promise<ActionResult<{ project_code: string }>> {
  try {
    const { data, error } = await supabaseServer
      .schema('projects')
      .rpc('generate_project_code')

    if (error) {
      console.error('Generate project code error:', error)
      return { success: false, error: 'Failed to generate project code' }
    }

    return { success: true, data: { project_code: data } }
  } catch (error) {
    console.error('Generate project code error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// GET PROJECT VERSIONS
// ============================================================================

export async function getProjectVersionsAction(
  projectId: string
): Promise<ActionResult<ProjectVersion[]>> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    const { data, error } = await supabaseServer
      .schema('projects')
      .from('project_versions')
      .select('*')
      .eq('project_id', sanitizedProjectId)
      .order('version_number', { ascending: false })

    if (error) {
      console.error('Get project versions error:', error)
      return { success: false, error: 'Failed to get project versions' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('Get project versions error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// CREATE PROJECT VERSION
// ============================================================================

export interface CreateVersionInput {
  project_id: string
  version_number: number
  google_drive_folder_id?: string
  notes?: string
  created_by?: string
}

export async function createProjectVersionAction(
  input: CreateVersionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const sanitizedProjectId = validateProjectId(input.project_id)

    const { data, error } = await supabaseServer
      .schema('projects')
      .from('project_versions')
      .insert({
        project_id: sanitizedProjectId,
        version_number: input.version_number,
        google_drive_folder_id: input.google_drive_folder_id || null,
        notes: input.notes?.trim() || null,
        created_by: input.created_by || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Create project version error:', error)
      return { success: false, error: 'Failed to create project version' }
    }

    // Update current_version on the project
    await supabaseServer
      .schema('projects')
      .from('projects')
      .update({ current_version: input.version_number, updated_at: new Date().toISOString() })
      .eq('id', sanitizedProjectId)

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Create project version error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// UPDATE PROJECT GOOGLE DRIVE FOLDER
// ============================================================================

export async function updateProjectDriveFolderAction(
  projectId: string,
  googleDriveFolderId: string
): Promise<ActionResult> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    const { error } = await supabaseServer
      .schema('projects')
      .from('projects')
      .update({
        google_drive_folder_id: googleDriveFolderId,
        updated_at: new Date().toISOString()
      })
      .eq('id', sanitizedProjectId)

    if (error) {
      console.error('Update project drive folder error:', error)
      return { success: false, error: 'Failed to update project drive folder' }
    }

    return { success: true }
  } catch (error) {
    console.error('Update project drive folder error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// ARCHIVE PROJECT
// ============================================================================

export async function archiveProjectAction(
  projectId: string
): Promise<ActionResult> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    const { error } = await supabaseServer
      .schema('projects')
      .from('projects')
      .update({
        is_archived: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', sanitizedProjectId)

    if (error) {
      console.error('Archive project error:', error)
      return { success: false, error: 'Failed to archive project' }
    }

    return { success: true }
  } catch (error) {
    console.error('Archive project error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// ADD PRODUCT TO PROJECT
// ============================================================================

export interface AddProductToProjectInput {
  project_id: string
  product_id: string
  area_version_id?: string  // NEW: Assign to specific area version
  quantity?: number
  room_location?: string
  notes?: string
}

/**
 * Add a product to a project with default quantity of 1
 * Fetches product price from product_info and stores it
 */
export async function addProductToProjectAction(
  input: AddProductToProjectInput
): Promise<ActionResult<{ id: string }>> {
  try {
    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(input.project_id)) {
      return { success: false, error: 'Invalid project ID format' }
    }
    if (!uuidRegex.test(input.product_id)) {
      return { success: false, error: 'Invalid product ID format' }
    }

    // Fetch product price from product_info
    const { data: productData, error: productError } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('prices')
      .eq('product_id', input.product_id)
      .single()

    if (productError) {
      console.error('Fetch product price error:', productError)
    }

    // Extract price info from the prices array (use first/latest price entry)
    let unitPrice: number | null = null
    let discountPercent: number | null = null

    if (productData?.prices && Array.isArray(productData.prices) && productData.prices.length > 0) {
      const priceEntry = productData.prices[0] as {
        start_price?: number
        disc1?: number
        disc2?: number
        disc3?: number
      }
      unitPrice = priceEntry.start_price || null
      // Combine discounts (typically disc1 is the main discount)
      discountPercent = priceEntry.disc1 || 0
    }

    // Check if product already exists in project (and same area version if specified)
    let existingQuery = supabaseServer
      .schema('projects')
      .from('project_products')
      .select('id, quantity')
      .eq('project_id', input.project_id)
      .eq('product_id', input.product_id)

    if (input.area_version_id) {
      existingQuery = existingQuery.eq('area_version_id', input.area_version_id)
    } else {
      existingQuery = existingQuery.is('area_version_id', null)
    }

    const { data: existing, error: checkError } = await existingQuery.single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is expected if product doesn't exist
      console.error('Check existing product error:', checkError)
      return { success: false, error: 'Failed to check existing product' }
    }

    if (existing) {
      // Product already exists, increment quantity
      const newQuantity = existing.quantity + (input.quantity || 1)
      const { error: updateError } = await supabaseServer
        .schema('projects')
        .from('project_products')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Update product quantity error:', updateError)
        return { success: false, error: 'Failed to update product quantity' }
      }

      return { success: true, data: { id: existing.id } }
    }

    // Insert new product with price info (total_price is a generated column - calculated by DB)
    const quantity = input.quantity || 1
    const { data, error } = await supabaseServer
      .schema('projects')
      .from('project_products')
      .insert({
        project_id: input.project_id,
        product_id: input.product_id,
        area_version_id: input.area_version_id || null,  // NEW: Link to area version
        quantity: quantity,
        unit_price: unitPrice,
        discount_percent: discountPercent,
        // Note: total_price is a generated column, DB calculates it automatically
        room_location: input.room_location?.trim() || null,
        notes: input.notes?.trim() || null,
        status: 'specified',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Add product to project error:', error)
      return { success: false, error: 'Failed to add product to project' }
    }

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Add product to project error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// UPDATE PROJECT PRODUCT QUANTITY
// ============================================================================

/**
 * Update the quantity of a product in a project
 * Note: total_price is a generated column - DB recalculates it automatically
 */
export async function updateProjectProductQuantityAction(
  projectProductId: string,
  quantity: number
): Promise<ActionResult> {
  try {
    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(projectProductId)) {
      return { success: false, error: 'Invalid project product ID format' }
    }

    // Validate quantity
    if (quantity < 1 || !Number.isInteger(quantity)) {
      return { success: false, error: 'Quantity must be a positive integer' }
    }

    // Update quantity only - total_price is a generated column, DB recalculates automatically
    const { error } = await supabaseServer
      .schema('projects')
      .from('project_products')
      .update({
        quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectProductId)

    if (error) {
      console.error('Update project product quantity error:', error)
      return { success: false, error: 'Failed to update quantity' }
    }

    return { success: true }
  } catch (error) {
    console.error('Update project product quantity error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// REMOVE PRODUCT FROM PROJECT
// ============================================================================

/**
 * Remove a product from a project
 */
export async function removeProductFromProjectAction(
  projectProductId: string
): Promise<ActionResult> {
  try {
    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(projectProductId)) {
      return { success: false, error: 'Invalid project product ID format' }
    }

    const { error } = await supabaseServer
      .schema('projects')
      .from('project_products')
      .delete()
      .eq('id', projectProductId)

    if (error) {
      console.error('Remove product from project error:', error)
      return { success: false, error: 'Failed to remove product' }
    }

    return { success: true }
  } catch (error) {
    console.error('Remove product from project error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
