/**
 * Case Study Viewer Hooks
 *
 * Custom hooks for the Case Study Viewer component.
 * Each hook encapsulates a specific concern:
 *
 * - useCoordinateTransform: Page ↔ DWG coordinate conversion
 * - useViewerApi: Authentication, upload, translation polling
 * - useMeasurement: Measurement tool state and handlers
 * - useViewerEvents: DOM events and keyboard handlers
 * - useViewerInit: Complete viewer initialization lifecycle
 * - useCalibration: DWG calibration point detection
 */

export { useCoordinateTransform } from './use-coordinate-transform'
export { useViewerApi } from './use-viewer-api'
export { useMeasurement } from './use-measurement'
export { useViewerEvents } from './use-viewer-events'
export type { SelectedEntityInfo } from './use-viewer-events'
export { useViewerInit } from './use-viewer-init'
export { useCalibration } from './use-calibration'
export type { CalibrationResult } from './use-calibration'
