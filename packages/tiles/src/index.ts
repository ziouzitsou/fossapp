/**
 * @fossapp/tiles - Tile Generation Domain Package
 *
 * Provides utilities for creating grouped product layouts (tiles) for
 * print catalogs and AutoCAD drawings. Includes job progress tracking
 * and AutoLISP script generation.
 *
 * @remarks
 * Import patterns:
 * - `@fossapp/tiles` - Main exports (progress, types, scripts)
 * - `@fossapp/tiles/types` - Types only
 * - `@fossapp/tiles/scripts` - Script generator only
 * - `@fossapp/tiles/progress` - Progress store only
 *
 * The progress store is shared across tiles, playground, and symbol-generator
 * features for SSE-based real-time job tracking.
 *
 * @example
 * ```ts
 * import { generateTileScript, createJob, addProgress } from '@fossapp/tiles'
 *
 * const jobId = generateJobId()
 * createJob(jobId, 'LED Panel 600x600')
 * addProgress(jobId, 'script', 'Generating script...')
 * const script = generateTileScript(tileData)
 * ```
 *
 * @packageDocumentation
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
