/**
 * Planner Types
 *
 * Shared types for the planner feature including placements,
 * markers, and coordinate handling.
 *
 * Uses world coordinates from the DWG model. The DataVisualization
 * extension renders sprites at these positions, automatically
 * handling pan/zoom transformations.
 */

/**
 * A product placement on the floor plan
 * Coordinates are in DWG world units (same coordinate system as the model)
 *
 * Uses DataVisualization extension sprites which automatically
 * follow pan/zoom operations in the viewer.
 */
export interface Placement {
  id: string
  productId: string          // Reference to project_products.product_id
  projectProductId: string   // Reference to project_products.id
  productName: string        // Display name (foss_pid or description)
  worldX: number             // DWG world X coordinate
  worldY: number             // DWG world Y coordinate
  dbId: number               // Unique dbId for the sprite (for click handling)
  rotation: number           // Rotation in degrees
}

/**
 * @deprecated Legacy placement type from overlay approach
 */
export interface LegacyPlacement {
  id: string
  productId: string
  projectProductId: string
  productName: string
  worldX: number
  worldY: number
  rotation: number
  isSelected?: boolean
}

/**
 * MarkupsCore extension interface (simplified for our use)
 */
export interface MarkupsCoreExtension {
  enterEditMode: () => void
  leaveEditMode: () => void
  svg: SVGSVGElement
  duringEditMode: boolean
  getId: () => string
  beginActionGroup: () => void
  closeActionGroup: () => void
  clientToMarkups: (clientX: number, clientY: number) => { x: number; y: number }
  markupsToClient: (markupX: number, markupY: number) => { x: number; y: number }
  changeEditMode: (mode: unknown) => void
}

/**
 * DataVisualization extension interface
 * Used for placing product sprites on the floor plan
 */
export interface DataVisualizationExtension {
  addViewables: (data: ViewableData) => void
  removeAllViewables: () => void
  invalidateViewables: (
    dbIds: number[],
    callback: (viewable: SpriteViewable) => void
  ) => void
}

/**
 * ViewableData container for sprites
 */
export interface ViewableData {
  spriteSize: number
  addViewable: (viewable: SpriteViewable) => void
  finish: () => Promise<void>
}

/**
 * Individual sprite viewable
 */
export interface SpriteViewable {
  dbId: number
  position: { x: number; y: number; z: number }
  style: ViewableStyle
}

/**
 * Style for sprite viewables
 */
export interface ViewableStyle {
  // Created via new Autodesk.DataVisualization.Core.ViewableStyle()
}

/**
 * DataVisualization Core namespace types
 */
export interface DataVisualizationCore {
  ViewableType: {
    SPRITE: number
    GEOMETRY: number
  }
  ViewableStyle: new (
    type: number,
    color: unknown, // THREE.Color
    iconUrl: string
  ) => ViewableStyle
  ViewableData: new () => ViewableData
  SpriteViewable: new (
    position: { x: number; y: number; z: number },
    style: ViewableStyle,
    dbId: number
  ) => SpriteViewable
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
}
