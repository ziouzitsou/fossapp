/**
 * Centralized server actions export
 *
 * Domain-organized actions for better maintainability.
 * Import from '@/lib/actions' for backward compatibility,
 * or from specific domain files for explicit imports.
 *
 * Structure:
 * - dashboard.ts  → Stats, analytics, supplier/family aggregations, catalogs
 * - customers.ts  → Customer CRUD and search
 * - projects.ts   → Project CRUD and listing
 * - products.ts   → Product search and details
 * - suppliers.ts  → Supplier listing with counts
 * - taxonomy.ts   → Taxonomy tree operations
 * - validation.ts → Shared validation utilities
 */

// ============================================================================
// DASHBOARD & ANALYTICS
// ============================================================================

export {
  getDashboardStatsAction,
  getProductCountAction,
  getSupplierStatsAction,
  getTopFamiliesAction,
  getMostActiveUsersAction,
  getActiveCatalogsAction,
  type DashboardStats,
  type SupplierStats,
  type FamilyStats,
  type CatalogInfo,
  type ActiveUser,
} from './dashboard'

// ============================================================================
// CUSTOMERS
// ============================================================================

export {
  searchCustomersAction,
  getCustomerByIdAction,
  listCustomersAction,
  type CustomerSearchResult,
  type CustomerDetail,
  type CustomerListParams,
  type CustomerListResult,
} from './customers'

// ============================================================================
// PRODUCTS
// ============================================================================

export {
  searchProductsBasicAction,
  getProductByIdAction,
  getProductsByTaxonomyAction,
  getProductsByTaxonomyPaginatedAction,
  type ProductDetail,
  type ProductByTaxonomy,
  type ProductByTaxonomyResult,
  type ProductSearchResult,
} from '@fossapp/products/actions'

// ============================================================================
// PROJECTS
// ============================================================================

export {
  listProjectsAction,
  getProjectByIdAction,
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
  generateProjectCodeAction,
  updateProjectDriveFolderAction,
  archiveProjectAction,
  addProductToProjectAction,
  updateProjectProductQuantityAction,
  removeProductFromProjectAction,
  type ProjectListItem,
  type ProjectProduct,
  type ProjectContact,
  type ProjectDocument,
  type ProjectPhase,
  type ProjectDetail,
  type ProjectListParams,
  type ProjectListResult,
  type CreateProjectInput,
  type UpdateProjectInput,
  type AddProductToProjectInput,
  type ActionResult,
} from './projects'

// ============================================================================
// PROJECT AREAS (Multi-area versioning)
// ============================================================================

export {
  listProjectAreasAction,
  getAreaByIdAction,
  createAreaAction,
  updateAreaAction,
  deleteAreaAction,
  createAreaVersionAction,
  setAreaCurrentVersionAction,
  getAreaVersionsAction,
  deleteAreaVersionAction,
  getProjectAreasForDropdownAction,
  listAreaVersionProductsAction,
  type ProjectArea,
  type AreaVersion,
  type AreaVersionSummary,
  type AreaDropdownItem,
  type AreaVersionProduct,
  type CreateAreaInput,
  type UpdateAreaInput,
  type CreateVersionInput as CreateAreaVersionInput,
} from './project-areas'

// ============================================================================
// SUPPLIERS
// ============================================================================

export {
  getActiveSuppliersAction,
  getSuppliersWithTaxonomyCountsAction,
  type Supplier,
} from './suppliers'

// ============================================================================
// TAXONOMY
// ============================================================================

export {
  getTaxonomyWithCountsAction,
  type TaxonomyCategory,
} from './taxonomy'

// ============================================================================
// TILES
// ============================================================================

export {
  searchProductsForTilesAction,
} from './tiles'

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export {
  validateSearchQuery,
  validateProductId,
  validateCustomerId,
  validateProjectId,
  validateTaxonomyCode,
  validateSupplierId,
} from '@fossapp/core/validation'

// ============================================================================
// USER SETTINGS
// ============================================================================

export {
  getUserSettingsAction,
  updateUserSettingsAction,
  addToSearchHistoryAction,
  clearSearchHistoryAction,
  type UserSettings,
  type UpdateSettingsInput,
} from './user-settings'

// ============================================================================
// FEEDBACK CHAT
// ============================================================================

export {
  // Chat operations
  createChatAction,
  getChatAction,
  getUserChatsAction,
  updateChatStatusAction,
  updateChatSubjectAction,
  deleteChatAction,
  // Message operations
  getChatMessagesAction,
  addMessageAction,
  getRecentMessagesAction,
  // Storage operations
  getUploadUrlAction,
  getAttachmentUrlAction,
} from './feedback'
