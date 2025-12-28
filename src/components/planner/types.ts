/**
 * Planner Types
 *
 * Shared types for the planner feature including placements,
 * markers, and coordinate handling.
 */

/**
 * A product placement on the floor plan
 * Coordinates are in DWG world units (same coordinate system as the model)
 */
export interface Placement {
  id: string
  productId: string          // Reference to project_products.product_id
  projectProductId: string   // Reference to project_products.id
  productName: string        // Display name (foss_pid or description)
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
