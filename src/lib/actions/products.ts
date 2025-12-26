/**
 * @deprecated Import from @fossapp/products/actions instead
 * This file is a re-export stub for backward compatibility.
 *
 * Migration:
 *   Before: import { searchProductsBasicAction } from '@/lib/actions/products'
 *   After:  import { searchProductsBasicAction } from '@fossapp/products/actions'
 *
 * Note: No 'use server' directive here - the actual server actions
 * have the directive in @fossapp/products/actions
 */

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
