/**
 * @fossapp/projects/types
 * Project management types for FOSSAPP
 */

// Re-export area types for convenience
export * from './areas'

// ============================================================================
// PROJECT TYPES
// ============================================================================

/**
 * Project list item - summary for project listings
 */
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
  google_drive_folder_id?: string
  is_archived: boolean
}

/**
 * Product linked to a project
 */
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
  // Area revision information (for multi-area projects)
  area_revision_id?: string
  area_code?: string
  area_name?: string
  area_revision_number?: number
}

/**
 * Contact linked to a project
 */
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

/**
 * Document linked to a project
 */
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

/**
 * Project phase
 */
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

/**
 * Full project detail with related data
 */
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
  is_archived: boolean
  // Related data
  products: ProjectProduct[]
  contacts: ProjectContact[]
  documents: ProjectDocument[]
  phases: ProjectPhase[]
  areas: import('./areas').ProjectArea[]
}

// ============================================================================
// INPUT/PARAM TYPES
// ============================================================================

/**
 * Parameters for listing projects
 */
export interface ProjectListParams {
  page?: number
  pageSize?: number
  sortBy?: 'created_at' | 'project_code' | 'name' | 'status'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Result from listing projects
 */
export interface ProjectListResult {
  projects: ProjectListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Input for creating a project
 */
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

/**
 * Input for updating a project
 */
export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  actual_completion_date?: string
}

/**
 * Input for adding a product to a project
 */
export interface AddProductToProjectInput {
  project_id: string
  product_id: string
  area_revision_id?: string
  quantity?: number
  room_location?: string
  notes?: string
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generic action result type
 */
export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}
