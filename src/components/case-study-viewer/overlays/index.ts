/**
 * Viewer Overlays - UI overlays for the Case Study viewer
 *
 * This module provides various overlay components positioned on top of
 * the viewer canvas: loading states, coordinates, layers, measurement tools.
 */

// Loading and error states
export {
  ViewerLoadingOverlay,
  ViewerErrorOverlay,
  WebGLErrorOverlay,
  type LoadingStage,
  type ViewerOverlaysProps,
  type WebGLErrorOverlayProps,
} from './loading-overlays'

// Coordinate display with calibration/translation warnings
export {
  CoordinateOverlay,
  type CoordinateOverlayProps,
  type TranslationWarning,
} from './coordinate-overlay'

// Layer visibility panel
export {
  LayerPanel,
  type LayerInfo,
  type LayerPanelProps,
} from './layer-panel'

// Mode indicator badge
export {
  ModeIndicator,
  type ModeIndicatorProps,
} from './mode-indicator'

// Measurement tools
export {
  MeasurePanel,
  type MeasureMode,
  type MeasurePanelProps,
} from './measure-panel'

// Quick action buttons
export {
  ViewerQuickActions,
  type ViewerQuickActionsProps,
} from './quick-actions'
