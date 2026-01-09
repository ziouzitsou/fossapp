/**
 * useMeasurement Hook
 *
 * Manages the measurement tool state and handlers for the APS Viewer.
 * Uses event-based state synchronization instead of polling for better performance.
 *
 * Handles:
 * - Distance and area measurement mode toggling
 * - Clearing measurements
 * - Event-based detection of external deactivation (ESC key, etc.)
 *
 * @remarks
 * Uses these APS Viewer events:
 * - EXTENSION_ACTIVATED_EVENT: Fired when Measure extension activates
 * - EXTENSION_DEACTIVATED_EVENT: Fired when Measure extension deactivates (ESC, etc.)
 * - MEASUREMENT_COMPLETED_EVENT: Fired when a measurement is completed
 */

import { useState, useCallback, useEffect, useRef, type RefObject } from 'react'
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

/**
 * Hook for managing APS Viewer measurement tools with event-based state sync.
 *
 * @param options - Configuration options
 * @returns Measurement state and handlers
 */
export function useMeasurement({
  viewerRef,
  placementMode,
  onExitPlacementMode,
}: UseMeasurementOptions): UseMeasurementReturn {
  const [measureMode, setMeasureMode] = useState<MeasureMode>('none')
  const [hasMeasurement, setHasMeasurement] = useState(false)

  // Track if we're setting up listeners to avoid duplicate registrations
  const listenersSetupRef = useRef(false)

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
   * Set up event-based state synchronization
   * Listens for extension activation/deactivation and measurement completion events
   */
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || listenersSetupRef.current) return

    // Access Autodesk namespace for event constants
    // These events exist at runtime but aren't in our type definitions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Autodesk = window.Autodesk as any
    if (!Autodesk?.Viewing) return

    // Event constants - these are defined in the viewer but not in our types
    const EXTENSION_DEACTIVATED_EVENT = Autodesk.Viewing.EXTENSION_DEACTIVATED_EVENT
    const EXTENSION_ACTIVATED_EVENT = Autodesk.Viewing.EXTENSION_ACTIVATED_EVENT
    const MEASUREMENT_COMPLETED_EVENT = Autodesk.Viewing.MEASUREMENT_COMPLETED_EVENT

    // Skip if events aren't available (older viewer versions)
    if (!EXTENSION_DEACTIVATED_EVENT || !EXTENSION_ACTIVATED_EVENT) {
      console.warn('[useMeasurement] Extension events not available in this viewer version')
      return
    }

    // Event handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleExtensionDeactivated = (event: any) => {
      if (event?.extensionId === 'Autodesk.Measure') {
        // Extension was deactivated (ESC key, programmatic, etc.)
        setMeasureMode('none')
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleExtensionActivated = (event: any) => {
      if (event?.extensionId === 'Autodesk.Measure') {
        // Extension was activated - update mode if provided
        // The mode comes from our activate() call, so we already set it
        // This handles external activation (unlikely but possible)
        if (event.mode === 'distance' || event.mode === 'area') {
          setMeasureMode(event.mode)
        }
      }
    }

    const handleMeasurementCompleted = () => {
      // A measurement was completed
      setHasMeasurement(true)
    }

    // Register event listeners
    viewer.addEventListener(EXTENSION_DEACTIVATED_EVENT, handleExtensionDeactivated)
    viewer.addEventListener(EXTENSION_ACTIVATED_EVENT, handleExtensionActivated)

    // MEASUREMENT_COMPLETED_EVENT may not be available in all viewer versions
    if (MEASUREMENT_COMPLETED_EVENT) {
      viewer.addEventListener(MEASUREMENT_COMPLETED_EVENT, handleMeasurementCompleted)
    }

    listenersSetupRef.current = true

    // Cleanup on unmount
    return () => {
      viewer.removeEventListener(EXTENSION_DEACTIVATED_EVENT, handleExtensionDeactivated)
      viewer.removeEventListener(EXTENSION_ACTIVATED_EVENT, handleExtensionActivated)

      if (MEASUREMENT_COMPLETED_EVENT) {
        viewer.removeEventListener(MEASUREMENT_COMPLETED_EVENT, handleMeasurementCompleted)
      }

      listenersSetupRef.current = false
    }
  }, [viewerRef])

  return {
    measureMode,
    hasMeasurement,
    handleToggleMeasure,
    handleClearMeasurements,
    setMeasureMode,
  }
}
