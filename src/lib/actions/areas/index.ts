/**
 * Area Actions - Barrel Export
 *
 * Centralized exports for all area-related server actions.
 * Import from '@/lib/actions/areas' for clean access.
 *
 * Note: 'use server' is declared in each action file, not here.
 * Barrel exports should not have 'use server' directive.
 */

// ============================================================================
// TYPES - Re-exported from @fossapp/projects for backward compatibility
// ============================================================================

export type {
  ProjectArea,
  AreaRevision,
  AreaRevisionSummary,
  CreateAreaInput,
  UpdateAreaInput,
  CreateRevisionInput,
  UpdateRevisionInput,
  // Deprecated aliases
  AreaVersion,
  AreaVersionSummary,
  CreateVersionInput,
  UpdateVersionInput,
} from '@fossapp/projects/types/areas'

export type { ActionResult } from '@fossapp/projects'

// ============================================================================
// AREA CRUD ACTIONS
// ============================================================================

export {
  listProjectAreasAction,
  getAreaByIdAction,
  createAreaAction,
  updateAreaAction,
  deleteAreaAction,
} from './area-crud-actions'

// ============================================================================
// REVISION ACTIONS
// ============================================================================

export {
  createAreaRevisionAction,
  setAreaCurrentRevisionAction,
  getAreaRevisionsAction,
  deleteAreaRevisionAction,
} from './revision-actions'

// ============================================================================
// REVISION PRODUCTS ACTIONS
// ============================================================================

export {
  getProjectAreasForDropdownAction,
  listAreaRevisionProductsAction,
} from './revision-products-actions'

export type {
  AreaDropdownItem,
  AreaRevisionProduct,
} from './revision-products-actions'

// ============================================================================
// FLOOR PLAN ACTIONS
// ============================================================================

export {
  deleteAreaRevisionFloorPlanAction,
  loadAreaPlacementsAction,
  saveAreaPlacementsAction,
} from './floorplan-actions'

export type { PlacementData } from './floorplan-actions'
