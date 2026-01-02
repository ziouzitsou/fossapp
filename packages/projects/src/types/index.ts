/**
 * Project Management Types for FOSSAPP
 *
 * Defines TypeScript interfaces for the project management system, which tracks
 * lighting projects from initial design through completion. Projects contain
 * products, contacts, documents, phases, and areas (for multi-zone buildings).
 *
 * @remarks
 * Projects are stored in `public.projects` with related data in junction tables.
 * The types follow a ListItem/Detail pattern: lightweight summaries for listings,
 * full objects with nested relations for detail views.
 *
 * @module
 * @see {@link ./areas.ts} for ProjectArea and AreaRevision types
 */

// Re-export area types for convenience
export * from './areas'

// ============================================================================
// PROJECT TYPES
// ============================================================================

/**
 * Lightweight project summary for list views and tables.
 *
 * @remarks
 * Optimized for project list pages - contains only essential fields needed
 * for display and sorting. Use {@link ProjectDetail} for full project data.
 */
export interface ProjectListItem {
  /** UUID primary key */
  id: string
  /** Human-readable project code (e.g., "PRJ-2024-001") */
  project_code: string
  /** Project name in Greek */
  name: string
  /** Optional English name for international projects */
  name_en?: string
  /** Customer/client company name */
  customer_name?: string
  /** Customer name in English */
  customer_name_en?: string
  /** Project location city */
  city?: string
  /** Category: "Residential", "Commercial", "Industrial", etc. */
  project_type?: string
  /** Workflow status: "draft", "active", "completed", "on_hold" */
  status: string
  /** Priority level: "low", "medium", "high", "urgent" */
  priority: string
  /** Estimated project budget */
  estimated_budget?: number
  /** Budget currency code (e.g., "EUR") */
  currency?: string
  /** Project start date (ISO 8601) */
  start_date?: string
  /** Target completion date (ISO 8601) */
  expected_completion_date?: string
  /** Record creation timestamp */
  created_at: string
  /** Google Drive folder ID for project documents */
  google_drive_folder_id?: string
  /** Whether project is archived (hidden from active lists) */
  is_archived: boolean
}

/**
 * A lighting product assigned to a project with quantity and placement details.
 *
 * @remarks
 * Links products from items.product_info to a project with additional
 * project-specific metadata like room location and mounting height.
 * For multi-area projects, products are linked to specific area revisions.
 */
export interface ProjectProduct {
  /** Junction table primary key */
  id: string
  /** Foreign key to items.product_info */
  product_id: string
  /** FOSS product identifier for display */
  foss_pid: string
  /** Product description from catalog */
  description_short: string
  /** Number of units for this project */
  quantity: number
  /** Unit price (may differ from catalog due to project discounts) */
  unit_price?: number
  /** Applied discount percentage */
  discount_percent?: number
  /** Calculated total: quantity × unit_price × (1 - discount_percent/100) */
  total_price?: number
  /** Room or zone where product will be installed */
  room_location?: string
  /** Installation height in meters */
  mounting_height?: number
  /** Product status: "proposed", "approved", "ordered", "installed" */
  status: string
  /** Additional installation notes */
  notes?: string
  /** Links to specific area revision (for multi-area projects) */
  area_revision_id?: string
  /** Area code for display (denormalized) */
  area_code?: string
  /** Area name for display (denormalized) */
  area_name?: string
  /** Revision number for display (denormalized) */
  area_revision_number?: number
}

/**
 * A contact person associated with a project.
 *
 * @remarks
 * Projects typically have multiple contacts: customer representative,
 * architect, electrical engineer, contractor, etc.
 */
export interface ProjectContact {
  /** Junction table primary key */
  id: string
  /** Contact category: "customer", "architect", "contractor", etc. */
  contact_type: string
  /** Full name */
  name: string
  /** Company or firm name */
  company?: string
  /** Email address */
  email?: string
  /** Office phone */
  phone?: string
  /** Mobile phone */
  mobile?: string
  /** Role/title at their company */
  role?: string
  /** Whether this is the primary contact for their type */
  is_primary: boolean
  /** Additional notes about this contact */
  notes?: string
}

/**
 * A document or file attached to a project.
 *
 * @remarks
 * Documents can be stored locally (file_path) or externally (file_url).
 * Supports versioning to track document revisions.
 */
export interface ProjectDocument {
  /** Document primary key */
  id: string
  /** Category: "drawing", "specification", "quote", "contract", etc. */
  document_type: string
  /** Display title */
  title: string
  /** Document description or summary */
  description?: string
  /** Local file system path (for uploaded files) */
  file_path?: string
  /** External URL (for linked documents) */
  file_url?: string
  /** MIME type (e.g., "application/pdf") */
  mime_type?: string
  /** File size in bytes */
  file_size_bytes?: number
  /** Version identifier (e.g., "1.0", "rev2") */
  version: string
  /** Whether this is the current version */
  is_latest: boolean
  /** Upload timestamp */
  created_at: string
  /** User who uploaded the document */
  created_by?: string
}

/**
 * A defined phase within a project's lifecycle.
 *
 * @remarks
 * Large projects are divided into phases like "Design", "Procurement",
 * "Installation", each with separate budgets and timelines.
 */
export interface ProjectPhase {
  /** Phase primary key */
  id: string
  /** Ordinal position (1, 2, 3...) */
  phase_number: number
  /** Phase display name (e.g., "Design", "Installation") */
  phase_name: string
  /** Phase description and objectives */
  description?: string
  /** Budget allocated to this phase */
  budget?: number
  /** Phase status: "pending", "in_progress", "completed" */
  status: string
  /** Phase start date */
  start_date?: string
  /** Phase end/target date */
  end_date?: string
}

/**
 * Complete project data with all related entities.
 *
 * @remarks
 * Used for project detail pages where full information is needed.
 * Includes nested arrays for products, contacts, documents, phases, and areas.
 * For list views, use {@link ProjectListItem} instead.
 */
export interface ProjectDetail {
  /** UUID primary key */
  id: string
  /** Human-readable project code (e.g., "PRJ-2024-001") */
  project_code: string
  /** Project name in Greek */
  name: string
  /** Optional English name */
  name_en?: string
  /** Detailed project description */
  description?: string

  // Customer information
  /** Foreign key to customers table */
  customer_id?: string
  /** Customer company name (denormalized) */
  customer_name?: string
  /** Customer name in English (denormalized) */
  customer_name_en?: string
  /** Customer contact email (denormalized) */
  customer_email?: string
  /** Customer contact phone (denormalized) */
  customer_phone?: string

  // Location fields
  /** Street address of project site */
  street_address?: string
  /** Postal/ZIP code */
  postal_code?: string
  /** City name */
  city?: string
  /** Region or state */
  region?: string
  /** Prefecture (Greek administrative division) */
  prefecture?: string
  /** Country name or ISO code */
  country?: string
  /** GPS latitude for map display */
  latitude?: number
  /** GPS longitude for map display */
  longitude?: number

  // Project classification
  /** Category: "Residential", "Commercial", "Industrial", etc. */
  project_type?: string
  /** Subcategory for finer classification */
  project_category?: string
  /** Total building floor area in square meters */
  building_area_sqm?: number
  /** Estimated total budget */
  estimated_budget?: number
  /** Currency for budget (e.g., "EUR") */
  currency?: string

  // Status and timeline
  /** Workflow status: "draft", "active", "completed", "on_hold" */
  status: string
  /** Priority: "low", "medium", "high", "urgent" */
  priority: string
  /** Project start date (ISO 8601) */
  start_date?: string
  /** Target completion date (ISO 8601) */
  expected_completion_date?: string
  /** Actual completion date (set when project completes) */
  actual_completion_date?: string

  // Team members
  /** Internal project manager */
  project_manager?: string
  /** Architecture firm name */
  architect_firm?: string
  /** Electrical engineering firm/consultant */
  electrical_engineer?: string
  /** Lighting design consultant */
  lighting_designer?: string

  // Metadata
  /** Free-form notes */
  notes?: string
  /** Searchable tags for filtering */
  tags?: string[]
  /** Record creation timestamp */
  created_at: string
  /** Last update timestamp */
  updated_at: string
  /** User who created the project */
  created_by?: string
  /** Google Drive folder ID for document storage */
  google_drive_folder_id?: string
  /** Whether project is archived */
  is_archived: boolean

  // Related entities (populated via joins)
  /** Products assigned to this project */
  products: ProjectProduct[]
  /** Contact persons for this project */
  contacts: ProjectContact[]
  /** Attached documents and files */
  documents: ProjectDocument[]
  /** Project phases/milestones */
  phases: ProjectPhase[]
  /** Building areas (for multi-zone projects) */
  areas: import('./areas').ProjectArea[]
}

// ============================================================================
// INPUT/PARAM TYPES
// ============================================================================

/**
 * Query parameters for paginated project listings.
 */
export interface ProjectListParams {
  /** Page number (1-indexed) */
  page?: number
  /** Number of projects per page */
  pageSize?: number
  /** Field to sort by */
  sortBy?: 'created_at' | 'project_code' | 'name' | 'status'
  /** Sort direction */
  sortOrder?: 'asc' | 'desc'
}

/**
 * Paginated result wrapper for project listings.
 */
export interface ProjectListResult {
  /** Projects for the current page */
  projects: ProjectListItem[]
  /** Total matching projects across all pages */
  total: number
  /** Current page number (1-indexed) */
  page: number
  /** Number of projects per page */
  pageSize: number
  /** Total number of available pages */
  totalPages: number
}

/**
 * Input data for creating a new project.
 *
 * @remarks
 * Only project_code and name are required. All other fields
 * can be added later via {@link UpdateProjectInput}.
 */
export interface CreateProjectInput {
  /** Required: Unique project code (e.g., "PRJ-2024-001") */
  project_code: string
  /** Required: Project name */
  name: string
  /** English project name */
  name_en?: string
  /** Project description */
  description?: string
  /** Link to existing customer */
  customer_id?: string
  /** Site street address */
  street_address?: string
  /** Site postal code */
  postal_code?: string
  /** Site city */
  city?: string
  /** Site region */
  region?: string
  /** Site prefecture */
  prefecture?: string
  /** Site country */
  country?: string
  /** Project type classification */
  project_type?: string
  /** Project subcategory */
  project_category?: string
  /** Building floor area in m² */
  building_area_sqm?: number
  /** Estimated budget */
  estimated_budget?: number
  /** Budget currency */
  currency?: string
  /** Initial status (defaults to "draft") */
  status?: string
  /** Initial priority (defaults to "medium") */
  priority?: string
  /** Project start date */
  start_date?: string
  /** Target completion date */
  expected_completion_date?: string
  /** Assigned project manager */
  project_manager?: string
  /** Architecture firm */
  architect_firm?: string
  /** Electrical engineer */
  electrical_engineer?: string
  /** Lighting designer */
  lighting_designer?: string
  /** Initial notes */
  notes?: string
  /** Initial tags */
  tags?: string[]
}

/**
 * Input data for updating an existing project.
 *
 * @remarks
 * All fields are optional - only provided fields will be updated.
 * Extends CreateProjectInput with actual_completion_date for project closure.
 */
export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  /** Set when project is actually completed */
  actual_completion_date?: string
}

/**
 * Input data for adding a product to a project.
 *
 * @remarks
 * Creates an entry in the project_products junction table.
 * For multi-area projects, specify area_revision_id to associate
 * the product with a specific area version.
 */
export interface AddProductToProjectInput {
  /** Target project UUID */
  project_id: string
  /** Product UUID from items.product_info */
  product_id: string
  /** Optional area revision for multi-area projects */
  area_revision_id?: string
  /** Number of units (defaults to 1) */
  quantity?: number
  /** Room or zone for installation */
  room_location?: string
  /** Additional installation notes */
  notes?: string
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generic server action result wrapper.
 *
 * @remarks
 * Provides a consistent pattern for server action returns.
 * Success is true with optional data, or false with error message.
 *
 * @typeParam T - Type of the data payload on success
 *
 * @example
 * ```ts
 * async function createProject(input: CreateProjectInput): Promise<ActionResult<ProjectDetail>> {
 *   try {
 *     const project = await db.insert(input)
 *     return { success: true, data: project }
 *   } catch (error) {
 *     return { success: false, error: error.message }
 *   }
 * }
 * ```
 */
export interface ActionResult<T = void> {
  /** Whether the action succeeded */
  success: boolean
  /** Payload data on success */
  data?: T
  /** Error message on failure */
  error?: string
}
