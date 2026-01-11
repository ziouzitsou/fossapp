/**
 * Case Study Viewer Components
 *
 * Dedicated components for the Case Study feature (floor plan viewing with symbol placement).
 * Kept separate from tiles/playground to evolve independently.
 *
 * Architecture:
 * The CaseStudyViewer component is organized using custom hooks for separation of concerns:
 * - useCoordinateTransform: Page ↔ DWG coordinate conversion
 * - useViewerApi: Authentication, upload, translation polling
 * - useMeasurement: Measurement tool state and handlers
 * - useViewerEvents: DOM events and keyboard handlers
 * - useViewerInit: Complete viewer initialization lifecycle
 */

export { CaseStudyViewer } from './case-study-viewer'
export type {
  CaseStudyViewerProps,
  WorldCoordinates,
  ViewerTool,
  Viewer3DInstance,
} from './case-study-viewer'

export { ProductsPanel } from './products-panel'

// Edit2D-based markers for product placement (managed shapes, proper selection)
export { Edit2DMarkers } from './edit2d-markers'
export type { Edit2DMarkerData, Edit2DMarkerCallbacks } from './edit2d-markers'

export type {
  Placement,
  PanelProduct,
  DragProductData,
  PlacementModeProduct,
  DwgUnitInfo,
  TranslationStatus,
  PageToModelTransform,
  ViewerMode,
} from './types'

// Viewer overlays
export { ModeIndicator } from './overlays'
export type { ModeIndicatorProps } from './overlays'

// Export hooks for potential reuse or testing
export {
  useCoordinateTransform,
  useViewerApi,
  useMeasurement,
  useViewerEvents,
  useViewerInit,
} from './hooks'
