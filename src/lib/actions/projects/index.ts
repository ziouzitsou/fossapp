/**
 * Project Actions - Barrel Export
 *
 * Centralized exports for all project-related server actions.
 * Import from '@/lib/actions/projects' for clean access.
 *
 * Note: 'use server' is declared in each action file, not here.
 */

// ============================================================================
// TYPES - Re-exported from @fossapp/projects for backward compatibility
// ============================================================================

export type {
  ProjectListItem,
  ProjectProduct,
  ProjectContact,
  ProjectDocument,
  ProjectPhase,
  ProjectDetail,
  ProjectListParams,
  ProjectListResult,
  CreateProjectInput,
  UpdateProjectInput,
  AddProductToProjectInput,
  ActionResult,
  ProjectArea,
} from '@fossapp/projects'

// ============================================================================
// PROJECT CRUD ACTIONS
// ============================================================================

export {
  listProjectsAction,
  getProjectByIdAction,
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
} from './project-crud-actions'

// ============================================================================
// PROJECT PRODUCT ACTIONS
// ============================================================================

export {
  addProductToProjectAction,
  updateProjectProductQuantityAction,
  removeProductFromProjectAction,
} from './project-product-actions'

// ============================================================================
// PROJECT UTILITY ACTIONS
// ============================================================================

export {
  generateProjectCodeAction,
  updateProjectDriveFolderAction,
} from './project-utility-actions'
