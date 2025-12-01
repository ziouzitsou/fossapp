'use server'

import { supabaseServer } from '../supabase-server'
import { validateProjectId } from './validation'

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
  products: ProjectProduct[]
  contacts: ProjectContact[]
  documents: ProjectDocument[]
  phases: ProjectPhase[]
}

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
        customer_id
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
        created_at: project.created_at
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

    // Delete related records first (due to foreign key constraints)
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

    // Delete the project
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
      products: products,
      contacts: contacts || [],
      documents: documents || [],
      phases: phases || [],
    }
  } catch (error) {
    console.error('Get project by ID error:', error)
    return null
  }
}
