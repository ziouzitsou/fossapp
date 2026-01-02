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
// MOCK DATA GENERATORS (for Phase 1-2 development)
// ============================================================================

export const MOCK_AREAS: CaseStudyArea[] = [
  { id: '1', areaCode: 'GF', areaName: 'Ground Floor', revisionId: 'r1', revisionNumber: 1 },
  { id: '2', areaCode: 'FF', areaName: 'First Floor', revisionId: 'r2', revisionNumber: 1 },
  { id: '3', areaCode: 'GD', areaName: 'Garden', revisionId: 'r3', revisionNumber: 1 },
]

export const MOCK_LUMINAIRES: LuminaireProduct[] = [
  { id: '1', productId: 'p1', name: 'BOXY XL', code: 'MY8204045139', type: 'luminaire', symbol: 'A1', symbolLetter: 'A', symbolSequence: 1, hasSymbolDrawing: true, hasTile: true, tileAccessoryCount: 2, quantity: 5, placed: 3 },
  { id: '2', productId: 'p2', name: 'BOXY S', code: 'MY8204045140', type: 'luminaire', symbol: 'A2', symbolLetter: 'A', symbolSequence: 2, hasSymbolDrawing: true, hasTile: false, tileAccessoryCount: 0, quantity: 3, placed: 0 },
  { id: '3', productId: 'p3', name: 'MINI GRID', code: 'MY8204045141', type: 'luminaire', symbol: 'A3', symbolLetter: 'A', symbolSequence: 3, hasSymbolDrawing: false, hasTile: true, tileAccessoryCount: 1, quantity: 8, placed: 8 },
  { id: '4', productId: 'p4', name: 'PENDANT L', code: 'MY8204045142', type: 'luminaire', symbol: 'B1', symbolLetter: 'B', symbolSequence: 1, hasSymbolDrawing: true, hasTile: false, tileAccessoryCount: 0, quantity: 2, placed: 1 },
  { id: '5', productId: 'p5', name: 'TRACK SPOT', code: 'MY8204045143', type: 'luminaire', symbol: 'N1', symbolLetter: 'N', symbolSequence: 1, hasSymbolDrawing: false, hasTile: false, tileAccessoryCount: 0, quantity: 4, placed: 2 },
  { id: '6', productId: 'p6', name: 'OUTDOOR IP65', code: 'MY8204045144', type: 'luminaire', symbol: 'C1', symbolLetter: 'C', symbolSequence: 1, hasSymbolDrawing: true, hasTile: true, tileAccessoryCount: 1, quantity: 6, placed: 4 },
  { id: '7', productId: 'p7', name: 'LINEAR 120', code: 'MY8204045145', type: 'luminaire', symbol: 'D1', symbolLetter: 'D', symbolSequence: 1, hasSymbolDrawing: false, hasTile: false, tileAccessoryCount: 0, quantity: 10, placed: 5 },
  { id: '8', productId: 'p8', name: 'DOWNLIGHT PRO', code: 'MY8204045146', type: 'luminaire', symbol: 'A4', symbolLetter: 'A', symbolSequence: 4, hasSymbolDrawing: true, hasTile: true, tileAccessoryCount: 3, quantity: 12, placed: 12 },
]

export const MOCK_ACCESSORIES: AccessoryProduct[] = [
  { id: '101', productId: 'a1', name: 'Driver 350mA DALI', code: 'DRV350MA-DALI', type: 'driver', quantity: 5 },
  { id: '102', productId: 'a2', name: 'Optic 24° Narrow', code: 'OPT-24-BOXY', type: 'optic', quantity: 5 },
  { id: '103', productId: 'a3', name: 'Optic 36° Medium', code: 'OPT-36-BOXY', type: 'optic', quantity: 3 },
  { id: '104', productId: 'a4', name: 'Mount Bracket', code: 'MNT-BRK-01', type: 'mount', quantity: 2 },
  { id: '105', productId: 'a5', name: 'Emergency Kit', code: 'EMG-KIT-01', type: 'accessory', quantity: 4 },
]

export const MOCK_PLACEMENTS: Placement[] = [
  { id: 'pl1', projectProductId: '1', productId: 'p1', symbol: 'A1', worldX: 3200, worldY: 2000, rotation: 0 },
  { id: 'pl2', projectProductId: '1', productId: 'p1', symbol: 'A1', worldX: 6400, worldY: 4000, rotation: 90 },
  { id: 'pl3', projectProductId: '1', productId: 'p1', symbol: 'A1', worldX: 4800, worldY: 6000, rotation: 0 },
  { id: 'pl4', projectProductId: '4', productId: 'p4', symbol: 'B1', worldX: 4800, worldY: 2800, rotation: 45 },
]
