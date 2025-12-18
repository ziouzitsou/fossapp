/**
 * Planner Components
 *
 * Dedicated components for the Planner feature.
 * Kept separate from tiles/playground to evolve independently.
 *
 * Uses MarkupsCore extension for product markers that follow pan/zoom.
 */

export { PlannerViewer } from './planner-viewer'
export type {
  PlannerViewerProps,
  WorldCoordinates,
  ViewerTool,
  Viewer3DInstance,
} from './planner-viewer'

export { PlannerMarkups } from './planner-markups'
export { ProductsPanel } from './products-panel'

// Legacy exports (kept for reference, may be removed later)
export { PlannerOverlay } from './planner-overlay'
export { PlannerMarker } from './planner-marker'

export type {
  Placement,
  LegacyPlacement,
  PanelProduct,
  DragProductData,
  PlacementModeProduct,
} from './types'
