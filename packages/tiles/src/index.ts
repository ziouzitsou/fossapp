/**
 * @fossapp/tiles
 * Tile generation utilities for FOSSAPP
 *
 * Exports:
 * - progress: SSE streaming progress store (shared by playground, symbol-generator, tiles)
 * - types: Tile-specific types (BucketItem, TileGroup, ProductInfo for tiles)
 * - scripts: AutoLISP script generator
 */

// Re-export from submodules
export * from './progress'

// Types - TileMember from types (UI/bucket usage)
export {
  type ProductInfo,
  type ProductPrice,
  type MultimediaItem,
  type ProductFeature,
  type BucketItem,
  type TileMember,  // Use the types/index.ts version (required filenames)
  type TileGroup,
  getProductImage,
  getProductDrawing,
  getProductThumbnail,
  getProductLDC,
  getProductDeeplink,
} from './types'

// Scripts - TileMember excluded (use scripts subpath import for script-specific types)
export {
  type TileData,
  type ScriptSettings,
  TileScriptGenerator,
  pixelsToMm,
  calculateAutoCADScale,
  calculateMemberScaling,
  calculateContainerDimensions,
  generateTileScript,
  previewTileScript,
} from './scripts'
