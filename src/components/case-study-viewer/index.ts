/**
 * Case Study Viewer Components
 *
 * Dedicated components for the Case Study feature (floor plan viewing with symbol placement).
 * Kept separate from tiles/playground to evolve independently.
 */

export { CaseStudyViewer } from './case-study-viewer'
export type {
  CaseStudyViewerProps,
  WorldCoordinates,
  ViewerTool,
  Viewer3DInstance,
} from './case-study-viewer'

export { ProductsPanel } from './products-panel'
// Note: PlannerMarkups removed - using MarkupMarkers (SVG) instead of HTML overlay

export type {
  Placement,
  PanelProduct,
  DragProductData,
  PlacementModeProduct,
  DwgUnitInfo,
} from './types'
