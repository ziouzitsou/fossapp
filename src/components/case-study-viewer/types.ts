/**
 * Case Study Viewer Types
 *
 * Shared types for the case study feature including placements,
 * markers, coordinate handling, and viewer state.
 */

import type { WorldCoordinates as WorldCoordsType } from '@/types/autodesk-viewer'

// Re-export WorldCoordinates for consumers
export type WorldCoordinates = WorldCoordsType

/**
 * Navigation tool modes for the viewer
 */
export type ViewerTool = 'pan' | 'orbit' | 'zoom' | 'select'

/**
 * Translation status from APS Model Derivative API
 */
export interface TranslationStatus {
  status: 'pending' | 'inprogress' | 'success' | 'failed'
  progress: string
  messages?: string[]
}

/**
 * Page-to-model transform values extracted from Matrix4
 * Format: [scaleX, scaleY, translateX, translateY] from column-major layout
 */
export type PageToModelTransform = [number, number, number, number]

/**
 * A product placement on the floor plan
 * Coordinates are in DWG world units (same coordinate system as the model)
 */
export interface Placement {
  id: string
  productId: string          // Reference to project_products.product_id
  projectProductId: string   // Reference to project_products.id
  productName: string        // Display name (description)
  fossPid?: string           // FOSS product ID for symbol lookup (e.g., "DT285029320B")
  worldX: number             // DWG world X coordinate
  worldY: number             // DWG world Y coordinate
  dbId: number               // Unique dbId for the marker
  rotation: number           // Rotation in degrees
  symbol?: string            // Symbol label (e.g., "A1", "B2") for floor plan display
}

/**
 * Product info for the products panel
 */
export interface PanelProduct {
  id: string                 // project_products.id
  productId: string          // product_id (UUID)
  fossPid: string            // FOSS product ID (e.g., "ZL-123")
  description: string        // Short description
  quantity: number           // Quantity in project
  placedCount: number        // How many already placed on floor plan
  symbol?: string            // Symbol label (e.g., "A1") from classification
  symbolCode?: string        // Symbol letter only (e.g., "A")
}

/**
 * Drag data transferred during drag & drop
 */
export interface DragProductData {
  projectProductId: string
  productId: string
  fossPid: string
  description: string
}

/**
 * Product selected for click-to-place mode
 * When set, clicking on the floor plan places this product
 */
export interface PlacementModeProduct {
  projectProductId: string
  productId: string
  fossPid: string
  description: string
  symbol?: string            // Symbol label to display on marker (e.g., "A1")
}

/**
 * Viewer interaction mode (similar to AutoCAD command modes)
 *
 * - IDLE: Default mode, pan/zoom navigation (ESC to enter)
 * - SELECT: Selection mode for placed markers
 * - MEASUREMENT: Measurement tools active (length/area)
 * - PLACEMENT: Placing a new marker (product selected from panel)
 * - MOVE: Moving a marker (M key when marker selected)
 */
export type ViewerMode = 'IDLE' | 'SELECT' | 'MEASUREMENT' | 'PLACEMENT' | 'MOVE'

/**
 * DWG unit information extracted from the APS viewer model
 * Used to display drawing unit metadata to users
 */
export interface DwgUnitInfo {
  unitString: string | null       // e.g., "mm", "cm", "m", "in", "ft"
  displayUnit: string | null      // Display unit string
  unitScale: number | null        // Scale factor to meters (e.g., 0.001 for mm)
  pageUnits: string | null        // From page_dimensions metadata (2D)
  modelUnits: string | null       // From page_dimensions metadata (2D)
}
