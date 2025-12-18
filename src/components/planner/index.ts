/**
 * Planner Components
 *
 * Dedicated components for the Planner feature.
 * Kept separate from tiles/playground to evolve independently.
 */

export { PlannerViewer } from './planner-viewer'
export type {
  PlannerViewerProps,
  WorldCoordinates,
  ViewerTool,
  Viewer3DInstance,
} from './planner-viewer'

export { ProductsPanel } from './products-panel'
// Note: PlannerMarkups removed - using MarkupMarkers (SVG) instead of HTML overlay

export type {
  Placement,
  PanelProduct,
  DragProductData,
  PlacementModeProduct,
} from './types'
