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
  AreaVersion,
  AreaVersionSummary,
  CreateAreaInput,
  UpdateAreaInput,
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
// VERSION ACTIONS
// ============================================================================

export {
  createAreaVersionAction,
  setAreaCurrentVersionAction,
  getAreaVersionsAction,
  deleteAreaVersionAction,
} from './version-actions'

// ============================================================================
// VERSION PRODUCTS ACTIONS
// ============================================================================

export {
  getProjectAreasForDropdownAction,
  listAreaVersionProductsAction,
} from './version-products-actions'

export type {
  AreaDropdownItem,
  AreaVersionProduct,
} from './version-products-actions'

// ============================================================================
// FLOOR PLAN ACTIONS
// ============================================================================

export {
  deleteAreaVersionFloorPlanAction,
  loadAreaPlacementsAction,
  saveAreaPlacementsAction,
} from './floorplan-actions'

export type { PlacementData } from './floorplan-actions'
