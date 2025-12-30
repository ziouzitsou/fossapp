/**
 * @fossapp/products - Product catalog domain package
 *
 * Contains product search, display, and taxonomy functionality.
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
