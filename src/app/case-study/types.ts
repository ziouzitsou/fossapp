/**
 * Case Study Page Types
 *
 * Local types for the Case Study (Planner V2) page.
 * These are UI-focused types - mapping from database types happens in Phase 3.
 */

// ============================================================================
// VIEW & MODE TYPES
// ============================================================================

/** Main view mode - Products panel or DWG Viewer */
export type ViewMode = 'products' | 'viewer'

/** Viewer tool mode */
export type ViewerTool = 'select' | 'pan'

/** Product type classification */
export type ProductType = 'luminaire' | 'driver' | 'optic' | 'mount' | 'accessory'

// ============================================================================
// AREA TYPES
// ============================================================================

/** Simplified area for dropdown selection */
export interface CaseStudyArea {
  id: string
  areaCode: string
  areaName: string
  revisionId: string
  revisionNumber: number
  floorPlanUrn?: string
  floorPlanFilename?: string
  floorPlanStatus?: 'pending' | 'inprogress' | 'success' | 'failed'
}

// ============================================================================
// PRODUCT TYPES
// ============================================================================

/** Base product info (shared between luminaires and accessories) */
interface BaseProduct {
  id: string              // project_products.id (not product.id)
  productId: string       // items.product.id
  name: string            // description_short
  code: string            // foss_pid
  quantity: number
  imageUrl?: string       // MD01/MD02 thumbnail
  drawingUrl?: string     // MD12/MD64 line drawing
}

/** Luminaire product - gets symbol, can be placed on viewer */
export interface LuminaireProduct extends BaseProduct {
  type: 'luminaire'
  symbol: string          // e.g., "A1", "B2", "N1"
  symbolLetter: string    // e.g., "A", "B", "N" (from ETIM class)
  symbolSequence: number  // e.g., 1, 2, 3 (within letter category)
  hasSymbolDrawing: boolean
  hasTile: boolean
  tileId?: string
  tileAccessoryCount: number
  placed: number          // count of placements
}

/** Accessory product - drivers, optics, mounts, etc. */
export interface AccessoryProduct extends BaseProduct {
  type: 'driver' | 'optic' | 'mount' | 'accessory'
}

/** Union type for any product in the Case Study */
export type CaseStudyProduct = LuminaireProduct | AccessoryProduct

/** Type guard for luminaire products */
export function isLuminaire(product: CaseStudyProduct): product is LuminaireProduct {
  return product.type === 'luminaire'
}

// ============================================================================
// PLACEMENT TYPES
// ============================================================================

/** Single placement on the floor plan */
export interface Placement {
  id: string
  projectProductId: string  // Links to CaseStudyProduct.id
  productId: string         // items.product.id for quick lookup
  symbol: string            // e.g., "A1"
  worldX: number            // DWG model space X coordinate (mm)
  worldY: number            // DWG model space Y coordinate (mm)
  rotation: number          // Rotation in degrees (0-360)
}

/** Placement mode when user is placing a product */
export interface PlacementMode {
  productId: string         // project_products.id
  symbol: string            // e.g., "A1"
  productName: string       // For status bar display
}

// ============================================================================
// TILE TYPES (Phase 2 stubs - full implementation in Phase 5)
// ============================================================================

/** Tile reference - minimal info for display */
export interface TileReference {
  id: string
  name: string
  luminaireProductId: string
  accessoryCount: number
}

// ============================================================================
// VIEWER STATE TYPES
// ============================================================================

/** Mouse position in DWG model space */
export interface ViewerCoordinates {
  x: number  // millimeters
  y: number  // millimeters
}

/** Zoom and pan state */
export interface ViewerTransform {
  scale: number
  panX: number
  panY: number
}

// ============================================================================
// STATE TYPES
// ============================================================================

/** Main state shape for the Case Study page */
export interface CaseStudyState {
  // View state
  viewMode: ViewMode
  selectedAreaId: string | null

  // Data
  areas: CaseStudyArea[]
  luminaires: LuminaireProduct[]
  accessories: AccessoryProduct[]
  placements: Placement[]

  // Viewer state
  viewerTool: ViewerTool
  placementMode: PlacementMode | null
  mousePosition: ViewerCoordinates

  // Loading states
  isLoading: boolean
  error: string | null
}

/** Actions for state management */
export interface CaseStudyActions {
  // View actions
  setViewMode: (mode: ViewMode) => void
  setSelectedAreaId: (areaId: string) => void

  // Product actions
  updateProductQuantity: (productId: string, delta: number) => void

  // Placement actions
  startPlacement: (product: LuminaireProduct) => void
  cancelPlacement: () => void
  confirmPlacement: (coords: ViewerCoordinates) => void
  removePlacement: (placementId: string) => void
  updatePlacementRotation: (placementId: string, rotation: number) => void

  // Viewer actions
  setViewerTool: (tool: ViewerTool) => void
}

// ============================================================================
// NOTE: Mock data removed in Phase 3
// Real data is now fetched from Supabase via case-study/actions/index.ts
// ============================================================================
