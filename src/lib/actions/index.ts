/**
 * Centralized server actions export
 *
 * Domain-organized actions for better maintainability.
 * Import from '@/lib/actions' for backward compatibility,
 * or from specific domain files for explicit imports.
 *
 * Structure:
 * - dashboard.ts  → Stats, analytics, supplier/family aggregations
 * - customers.ts  → Customer CRUD and search
 * - projects.ts   → Project CRUD and listing (TODO: migrate)
 * - products.ts   → Product search and details (TODO: migrate)
 * - suppliers.ts  → Supplier listing (TODO: migrate)
 * - taxonomy.ts   → Taxonomy tree operations (TODO: migrate)
 * - validation.ts → Shared validation utilities
 */

// ============================================================================
// MIGRATED DOMAIN EXPORTS
// ============================================================================

// Dashboard & Analytics
export {
  getDashboardStatsAction,
  getProductCountAction,
  getSupplierStatsAction,
  getTopFamiliesAction,
  getMostActiveUsersAction,
  type DashboardStats,
  type SupplierStats,
  type FamilyStats,
  type CatalogInfo,
  type ActiveUser,
} from './dashboard'

// Customers
export {
  searchCustomersAction,
  getCustomerByIdAction,
  listCustomersAction,
  type CustomerSearchResult,
  type CustomerDetail,
  type CustomerListParams,
  type CustomerListResult,
} from './customers'

// Validation utilities (for use in other modules)
export {
  validateSearchQuery,
  validateProductId,
  validateCustomerId,
  validateProjectId,
} from './validation'

// ============================================================================
// NOT YET MIGRATED - Re-export from original actions.ts
// TODO: Migrate these to their domain files
// ============================================================================

export {
  // Products
  searchProductsBasicAction,
  getProductByIdAction,
  getProductsByTaxonomyAction,
  getProductsByTaxonomyPaginatedAction,
  type ProductSearchResult,
  type ProductDetail,
  type ProductByTaxonomy,
  type ProductByTaxonomyResult,

  // Projects
  listProjectsAction,
  getProjectByIdAction,
  type ProjectListItem,
  type ProjectProduct,
  type ProjectContact,
  type ProjectDocument,
  type ProjectPhase,
  type ProjectDetail,
  type ProjectListParams,
  type ProjectListResult,

  // Suppliers
  getActiveSuppliersAction,
  getSuppliersWithTaxonomyCountsAction,
  type Supplier,

  // Taxonomy
  getTaxonomyWithCountsAction,

  // Catalogs (uses dashboard interface but function in original file)
  getActiveCatalogsAction,
} from '../actions'
