/**
 * @deprecated Import from '@/lib/actions' now resolves to domain-organized files.
 * This file re-exports everything for backward compatibility.
 *
 * Preferred imports:
 * - import { getDashboardStatsAction } from '@/lib/actions/dashboard'
 * - import { searchCustomersAction } from '@/lib/actions/customers'
 * - import { searchProductsBasicAction } from '@/lib/actions/products'
 *
 * Domain files:
 * - dashboard.ts  → Stats, analytics, catalogs
 * - customers.ts  → Customer CRUD
 * - products.ts   → Product search and details
 * - projects.ts   → Project CRUD
 * - suppliers.ts  → Supplier listing
 * - taxonomy.ts   → Taxonomy operations
 * - validation.ts → Shared validation
 */

// Re-export everything from the domain-organized index
export * from './actions/index'
