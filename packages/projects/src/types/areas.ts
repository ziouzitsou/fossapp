/**
 * @fossapp/projects/types/areas
 * Project area and version types
 */

// ============================================================================
// AREA TYPES
// ============================================================================

/**
 * Project area (physical space within a project)
 */
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
  google_drive_folder_id?: string
  created_at: string
  updated_at: string
  // Populated when fetching with version data
  current_version_data?: AreaVersionSummary
  all_versions?: AreaVersion[]
}

/**
 * Area version (snapshot of area at a point in time)
 */
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

/**
 * Area version summary (with calculated fields)
 */
export interface AreaVersionSummary {
  id: string
  version_number: number
  version_name?: string
  notes?: string
  created_at: string
  created_by?: string
  product_count: number
  total_cost: number
  // Floor plan fields
  floor_plan_urn?: string
  floor_plan_filename?: string
  floor_plan_status?: string
  floor_plan_warnings?: number
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input for creating an area
 */
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

/**
 * Input for updating an area
 */
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

/**
 * Input for creating an area version
 */
export interface CreateVersionInput {
  area_id: string
  copy_from_version?: number
  version_name?: string
  notes?: string
  created_by?: string
}

/**
 * Input for updating an area version
 */
export interface UpdateVersionInput {
  version_name?: string
  notes?: string
  status?: string
}
