/**
 * @fossapp/products - Product Catalog Domain Package
 *
 * Provides product search, retrieval, and taxonomy-based filtering.
 * Products are stored in the items.product_info materialized view
 * and classified using the ETIM standard.
 *
 * @remarks
 * Import patterns:
 * - `@fossapp/products` - Main exports (types, actions, constants)
 * - `@fossapp/products/types` - Types only
 * - `@fossapp/products/actions` - Server actions only
 *
 * @example
 * ```ts
 * import { ProductInfo, getProductByIdAction } from '@fossapp/products'
 *
 * const product = await getProductByIdAction(productId)
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
  TemplateType,
  ProductSearchResult,
  ProductInfo,
  Price,
  Multimedia,
  Feature,
  FeatureGroupConfig,
} from './types'

export {
  MIME_CODES,
  ETIM_FEATURE_GROUPS,
  PRODUCT_DISTRIBUTION,
} from './types'

// Actions
export {
  searchProductsBasicAction,
  searchProductsFTSAction,
  getProductByIdAction,
  getProductsByTaxonomyAction,
  getProductsByTaxonomyPaginatedAction,
  type ProductDetail,
  type ProductByTaxonomy,
  type ProductByTaxonomyResult,
} from './actions'
