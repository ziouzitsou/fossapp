'use client'

/**
 * CaseStudyViewerToolbar - Custom toolbar for the case study viewer
 *
 * Provides tool controls outside the WebGL canvas.
 * Currently minimal - measurement tools are now in MeasurePanel overlay.
 *
 * @remarks
 * This toolbar is positioned at the bottom of the viewer container,
 * outside the canvas, allowing full control over styling.
 * Future tools (e.g., annotation, export) can be added here.
 */

// Re-export MeasureMode type for backwards compatibility
// (Now defined in viewer-overlays.tsx, but keep export here for existing imports)
export type MeasureMode = 'none' | 'distance' | 'area'

export interface ViewerToolbarProps {
  /** Current measurement mode */
  measureMode: MeasureMode
  /** Whether there's an active measurement */
  hasMeasurement: boolean
  /** Callback to toggle measurement mode */
  onToggleMeasure: (mode: 'distance' | 'area') => void
  /** Callback to clear measurements */
  onClearMeasurements: () => void
}

/**
 * Toolbar component for the Case Study viewer.
 *
 * Currently renders an empty toolbar bar - measurement tools have been
 * moved to MeasurePanel overlay for better UX (positioned near layers panel).
 *
 * Props are kept for API compatibility but not currently used.
 * Future tools can be added here as needed.
 */
export function CaseStudyViewerToolbar({
  // Props kept for API compatibility - may be used by future tools
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  measureMode,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hasMeasurement,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onToggleMeasure,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onClearMeasurements,
}: ViewerToolbarProps) {
  // Toolbar currently empty - measurement tools moved to MeasurePanel overlay
  // Return null to hide the empty toolbar bar
  return null
}
