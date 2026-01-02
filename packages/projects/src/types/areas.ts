/**
 * Project Area and Revision Types
 *
 * Defines types for managing areas (physical spaces) within a project.
 * Areas support version control through revisions, allowing tracking of
 * design iterations with different product selections.
 *
 * @remarks
 * Areas are typically floors, zones, or rooms within a building project.
 * Each area can have multiple revisions (e.g., "Initial Design", "After Client Review").
 * Products are linked to specific area revisions, not directly to areas.
 *
 * @module
 * @see {@link ./index.ts} for main project types
 */

// ============================================================================
// AREA TYPES
// ============================================================================

/**
 * A physical space or zone within a project.
 *
 * @remarks
 * Areas represent distinct spaces like floors, rooms, or zones.
 * Each area tracks its own revision history, allowing different
 * product selections to be compared across design iterations.
 */
export interface ProjectArea {
  /** UUID primary key */
  id: string
  /** Foreign key to parent project */
  project_id: string
  /** Short code for display (e.g., "A1", "LOBBY", "FL-03") */
  area_code: string
  /** Area name in Greek */
  area_name: string
  /** Optional English name */
  area_name_en?: string
  /** Area category: "floor", "room", "zone", "outdoor", etc. */
  area_type?: string
  /** Floor number (0 = ground, negative = basement) */
  floor_level?: number
  /** Area size in square meters */
  area_sqm?: number
  /** Ceiling height in meters */
  ceiling_height_m?: number
  /** Current active revision number */
  current_revision: number
  /** Display order within project (for sorting) */
  display_order: number
  /** Whether area is active (false = soft deleted) */
  is_active: boolean
  /** Area description */
  description?: string
  /** Additional notes */
  notes?: string
  /** Google Drive folder ID for area documents */
  google_drive_folder_id?: string
  /** Creation timestamp */
  created_at: string
  /** Last update timestamp */
  updated_at: string

  // ===== Populated via Joins =====
  /** Summary of the current revision (when fetched) */
  current_revision_data?: AreaRevisionSummary
  /** All revisions for this area (when fetched) */
  all_revisions?: AreaRevision[]
}

/**
 * A versioned snapshot of an area's product selection.
 *
 * @remarks
 * Revisions allow tracking design iterations. When creating a new revision,
 * products can optionally be copied from a previous revision.
 * Revisions go through a workflow: draft → pending_approval → approved.
 */
export interface AreaRevision {
  /** UUID primary key */
  id: string
  /** Foreign key to parent area */
  area_id: string
  /** Sequential revision number (1, 2, 3...) */
  revision_number: number
  /** Optional descriptive name (e.g., "Initial", "Post-Review") */
  revision_name?: string
  /** Revision notes or change description */
  notes?: string
  /** Google Drive folder ID for revision documents */
  google_drive_folder_id?: string
  /** Workflow status: "draft", "pending_approval", "approved", "superseded" */
  status: string
  /** When revision was approved (if applicable) */
  approved_at?: string
  /** Who approved the revision */
  approved_by?: string
  /** Creation timestamp */
  created_at: string
  /** Who created the revision */
  created_by?: string

  // ===== Calculated Fields (from aggregations) =====
  /** Number of products in this revision */
  product_count?: number
  /** Total cost of all products */
  total_cost?: number
}

/**
 * Summary of a revision with calculated aggregations.
 *
 * @remarks
 * Includes floor plan integration fields for Autodesk Viewer support.
 * Used in area detail views and revision comparison.
 */
export interface AreaRevisionSummary {
  /** UUID primary key */
  id: string
  /** Sequential revision number */
  revision_number: number
  /** Optional descriptive name */
  revision_name?: string
  /** Revision notes */
  notes?: string
  /** Creation timestamp */
  created_at: string
  /** Who created the revision */
  created_by?: string
  /** Total products in this revision */
  product_count: number
  /** Total cost of products */
  total_cost: number

  // ===== Floor Plan Integration (Autodesk Viewer) =====
  /** Autodesk URN for floor plan SVF */
  floor_plan_urn?: string
  /** Original floor plan filename */
  floor_plan_filename?: string
  /** Translation status: "pending", "complete", "failed" */
  floor_plan_status?: string
  /** Number of translation warnings */
  floor_plan_warnings?: number
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input data for creating a new area within a project.
 *
 * @remarks
 * Creates the area and automatically creates revision 1 (empty draft).
 */
export interface CreateAreaInput {
  /** Target project UUID */
  project_id: string
  /** Required: Unique area code within project */
  area_code: string
  /** Required: Area name */
  area_name: string
  /** English area name */
  area_name_en?: string
  /** Area type classification */
  area_type?: string
  /** Floor number (0 = ground) */
  floor_level?: number
  /** Area size in m² */
  area_sqm?: number
  /** Ceiling height in meters */
  ceiling_height_m?: number
  /** Display order (auto-assigned if omitted) */
  display_order?: number
  /** Area description */
  description?: string
  /** Additional notes */
  notes?: string
  /** User creating the area */
  created_by?: string
}

/**
 * Input data for updating an existing area.
 *
 * @remarks
 * All fields are optional - only provided fields are updated.
 */
export interface UpdateAreaInput {
  /** New area code */
  area_code?: string
  /** New area name */
  area_name?: string
  /** New English name */
  area_name_en?: string
  /** New area type */
  area_type?: string
  /** New floor level */
  floor_level?: number
  /** New area size */
  area_sqm?: number
  /** New ceiling height */
  ceiling_height_m?: number
  /** New display order */
  display_order?: number
  /** New description */
  description?: string
  /** New notes */
  notes?: string
  /** Active status (false = soft delete) */
  is_active?: boolean
}

/**
 * Input data for creating a new area revision.
 *
 * @remarks
 * Optionally copies products from an existing revision using copy_from_revision.
 * The new revision starts in "draft" status.
 */
export interface CreateRevisionInput {
  /** Target area UUID */
  area_id: string
  /** Revision number to copy products from (optional) */
  copy_from_revision?: number
  /** Descriptive name for the revision */
  revision_name?: string
  /** Notes about this revision */
  notes?: string
  /** User creating the revision */
  created_by?: string
}

/**
 * Input data for updating an existing revision.
 *
 * @remarks
 * Status changes trigger workflow rules (e.g., approved revisions
 * become the current_revision on the parent area).
 */
export interface UpdateRevisionInput {
  /** New revision name */
  revision_name?: string
  /** Updated notes */
  notes?: string
  /** New status (triggers workflow) */
  status?: string
}

// ============================================================================
// DEPRECATED - kept for backwards compatibility during migration
// ============================================================================

/** @deprecated Use AreaRevision instead */
export type AreaVersion = AreaRevision
/** @deprecated Use AreaRevisionSummary instead */
export type AreaVersionSummary = AreaRevisionSummary
/** @deprecated Use CreateRevisionInput instead */
export type CreateVersionInput = CreateRevisionInput
/** @deprecated Use UpdateRevisionInput instead */
export type UpdateVersionInput = UpdateRevisionInput
