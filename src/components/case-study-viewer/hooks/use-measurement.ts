/**
 * useMeasurement Hook
 *
 * Manages the measurement tool state and handlers for the APS Viewer.
 * Handles:
 * - Distance and area measurement mode toggling
 * - Clearing measurements
 * - Polling for active measurements
 */

import { useState, useCallback, useEffect, type RefObject } from 'react'
import type { Viewer3DInstance } from '@/types/autodesk-viewer'
import type { MeasureMode } from '../viewer-toolbar'
import type { PlacementModeProduct } from '../types'

interface UseMeasurementOptions {
  viewerRef: RefObject<Viewer3DInstance | null>
  /** Current placement mode (measurement exits when entering placement) */
  placementMode?: PlacementModeProduct | null
  /** Callback to exit placement mode when entering measurement */
  onExitPlacementMode?: () => void
}

interface UseMeasurementReturn {
  /** Current measurement mode */
  measureMode: MeasureMode
  /** Whether there's an active measurement */
  hasMeasurement: boolean
  /** Toggle measurement mode (distance or area) */
  handleToggleMeasure: (mode: 'distance' | 'area') => void
  /** Clear all measurements */
  handleClearMeasurements: () => void
  /** Manually set measure mode (for external control) */
  setMeasureMode: (mode: MeasureMode) => void
}

export function useMeasurement({
  viewerRef,
  placementMode,
  onExitPlacementMode,
}: UseMeasurementOptions): UseMeasurementReturn {
  const [measureMode, setMeasureMode] = useState<MeasureMode>('none')
  const [hasMeasurement, setHasMeasurement] = useState(false)

  /**
   * Toggle measurement mode (distance or area)
   */
  const handleToggleMeasure = useCallback((mode: 'distance' | 'area') => {
    const viewer = viewerRef.current
    if (!viewer) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const measureExt = viewer.getExtension('Autodesk.Measure') as any
    if (!measureExt) return

    // Exit placement mode when entering measure mode
    if (placementMode) {
      onExitPlacementMode?.()
    }

    if (measureMode === mode) {
      // Same mode clicked - deactivate
      measureExt.deactivate()
      setMeasureMode('none')
    } else {
      // Different mode or none - activate new mode
      measureExt.activate(mode)
      setMeasureMode(mode)
    }
  }, [viewerRef, measureMode, placementMode, onExitPlacementMode])

  /**
   * Clear all measurements
   */
  const handleClearMeasurements = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const measureExt = viewer.getExtension('Autodesk.Measure') as any
    if (!measureExt) return

    // Clear all measurements
    measureExt.deleteCurrentMeasurement()
    setHasMeasurement(false)
  }, [viewerRef])

  /**
   * Exit measure mode when entering placement mode
   */
  useEffect(() => {
    if (placementMode && measureMode !== 'none') {
      const viewer = viewerRef.current
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const measureExt = viewer?.getExtension('Autodesk.Measure') as any
      if (measureExt) {
        measureExt.deactivate()
      }
      setMeasureMode('none')
    }
  }, [placementMode, measureMode, viewerRef])

  /**
   * Poll for measurements and detect if extension was deactivated externally (e.g., ESC key)
   */
  useEffect(() => {
    if (measureMode === 'none') {
      return
    }

    const viewer = viewerRef.current
    if (!viewer) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const measureExt = viewer.getExtension('Autodesk.Measure') as any
    if (!measureExt) return

    const checkForMeasurements = () => {
      // Check if the extension was deactivated externally (e.g., user pressed ESC)
      // The Measure extension handles ESC internally and deactivates itself
      const isActive = measureExt.isActive?.() ?? measureExt.mode !== 'inactive'
      if (!isActive) {
        // Extension was deactivated externally - sync our state
        // (We're guaranteed measureMode !== 'none' because we return early above)
        setMeasureMode('none')
        setHasMeasurement(false)
        return
      }

      const measureTool = measureExt.measureTool
      if (measureTool) {
        // Check if there's a current measurement
        const hasMeasure = measureTool._currentMeasurement != null ||
                          (measureTool._measurementsManager?.getMeasurementList?.()?.length > 0)
        setHasMeasurement(hasMeasure)
      }
    }

    // Check periodically while measuring
    const interval = setInterval(checkForMeasurements, 200)

    return () => clearInterval(interval)
  }, [viewerRef, measureMode])

  return {
    measureMode,
    hasMeasurement,
    handleToggleMeasure,
    handleClearMeasurements,
    setMeasureMode,
  }
}
