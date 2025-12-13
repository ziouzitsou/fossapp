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
} from './products'

// Re-export ProductSearchResult from types (canonical location)
export type { ProductSearchResult } from '@/types/product'

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
  getProjectVersionsAction,
  createProjectVersionAction,
  updateProjectDriveFolderAction,
  archiveProjectAction,
  addProductToProjectAction,
  updateProjectProductQuantityAction,
  removeProductFromProjectAction,
  type ProjectListItem,
  type ProjectVersion,
  type ProjectProduct,
  type ProjectContact,
  type ProjectDocument,
  type ProjectPhase,
  type ProjectDetail,
  type ProjectListParams,
  type ProjectListResult,
  type CreateProjectInput,
  type UpdateProjectInput,
  type CreateVersionInput,
  type AddProductToProjectInput,
  type ActionResult,
} from './projects'

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
} from './validation'

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
