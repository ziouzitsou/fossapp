/**
 * useCalibration Hook
 *
 * Detects calibration points in a DWG and calculates coordinate transformation.
 *
 * ## How It Works
 *
 * 1. After GEOMETRY_LOADED, searches for points on layer "CALIBRATION"
 * 2. Expects two points: CAL-ORIGIN at (0,0) and CAL-UNIT at (1,1) in DWG units
 * 3. Extracts their display coordinates from the vertex buffer
 * 4. Calculates affine transform: dwg = scale * display + offset
 *
 * ## DWG Preparation Required
 *
 * Add two POINT entities on layer "CALIBRATION":
 * - CAL-ORIGIN at coordinates (0, 0)
 * - CAL-UNIT at coordinates (1, 1)
 *
 * Points MUST be diagonal (not on same axis) to determine both X and Y scales.
 */

import { useState, useCallback, type RefObject } from 'react'
import type { Viewer3DInstance } from '@/types/autodesk-viewer'

/** Calibration layer name - points must be on this layer */
const CALIBRATION_LAYER = 'CALIBRATION'

/** Expected DWG coordinates for calibration points */
const EXPECTED_ORIGIN = { x: 0, y: 0 }
const EXPECTED_UNIT = { x: 1, y: 1 }

export interface CalibrationResult {
  /** Whether calibration was successful */
  isCalibrated: boolean
  /** Scale factor X (DWG units per display unit) */
  scaleX: number
  /** Scale factor Y (DWG units per display unit) */
  scaleY: number
  /** Offset X */
  offsetX: number
  /** Offset Y */
  offsetY: number
  /** Error message if calibration failed */
  error?: string
}

export interface CalibrationPoint {
  dbId: number
  name: string
  displayX: number
  displayY: number
}

interface UseCalibrationOptions {
  viewerRef: RefObject<Viewer3DInstance | null>
}

interface UseCalibrationReturn {
  /** Whether calibration is complete (either success or failure) */
  calibrationChecked: boolean
  /** Whether the DWG has valid calibration points */
  isCalibrated: boolean
  /** Error message if calibration failed */
  calibrationError: string | null
  /** Run calibration detection (call after GEOMETRY_LOADED) */
  detectCalibration: () => Promise<CalibrationResult>
  /** Get the calibration transform values */
  getCalibration: () => CalibrationResult | null
}

/**
 * Hook for detecting and computing DWG calibration transform
 */
export function useCalibration({
  viewerRef,
}: UseCalibrationOptions): UseCalibrationReturn {
  const [calibrationChecked, setCalibrationChecked] = useState(false)
  const [isCalibrated, setIsCalibrated] = useState(false)
  const [calibrationError, setCalibrationError] = useState<string | null>(null)
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null)

  /**
   * Find all dbIds on the CALIBRATION layer
   */
  const findCalibrationPoints = useCallback(async (): Promise<CalibrationPoint[]> => {
    const viewer = viewerRef.current
    if (!viewer?.model) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = viewer.model as any
    const tree = model.getInstanceTree?.()
    if (!tree) return []

    // Get all dbIds
    const allDbIds: number[] = []
    tree.enumNodeChildren(tree.getRootId(), (dbId: number) => {
      allDbIds.push(dbId)
    }, true)

    // Find points on CALIBRATION layer
    const calibrationPoints: CalibrationPoint[] = []

    for (const dbId of allDbIds) {
      const props = await getPropertiesAsync(model, dbId)
      if (!props) continue

      // Check if this is a Point on the CALIBRATION layer
      const layerProp = props.properties?.find(
        (p: { displayName: string }) => p.displayName === 'Layer'
      )
      const typeProp = props.properties?.find(
        (p: { displayName: string }) => p.displayName === 'type'
      )

      if (layerProp?.displayValue === CALIBRATION_LAYER && typeProp?.displayValue === 'AcDbPoint') {
        // Get display coordinates from vertex buffer
        const coords = getPointDisplayCoords(model, dbId)
        if (coords) {
          calibrationPoints.push({
            dbId,
            name: props.name || `Point_${dbId}`,
            displayX: coords.x,
            displayY: coords.y,
          })
        }
      }
    }

    return calibrationPoints
  }, [viewerRef])

  /**
   * Run calibration detection
   */
  const detectCalibration = useCallback(async (): Promise<CalibrationResult> => {
    const viewer = viewerRef.current
    if (!viewer?.model) {
      const result: CalibrationResult = {
        isCalibrated: false,
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
        error: 'No model loaded',
      }
      setCalibrationChecked(true)
      setIsCalibrated(false)
      setCalibrationError(result.error ?? null)
      setCalibrationResult(result)
      return result
    }

    try {
      const points = await findCalibrationPoints()

      // Deduplicate points by position (INSERT+EXPLODE may create duplicates)
      // Round to 2 decimal places to handle floating point precision
      const uniquePoints: CalibrationPoint[] = []
      const seenPositions = new Set<string>()
      for (const point of points) {
        const key = `${point.displayX.toFixed(2)},${point.displayY.toFixed(2)}`
        if (!seenPositions.has(key)) {
          seenPositions.add(key)
          uniquePoints.push(point)
        }
      }

      if (uniquePoints.length < 2) {
        const result: CalibrationResult = {
          isCalibrated: false,
          scaleX: 1,
          scaleY: 1,
          offsetX: 0,
          offsetY: 0,
          error: points.length === 0
            ? `No calibration points found on layer "${CALIBRATION_LAYER}"`
            : `Only ${uniquePoints.length} unique calibration point found (need 2, found ${points.length} total with duplicates)`,
        }
        setCalibrationChecked(true)
        setIsCalibrated(false)
        setCalibrationError(result.error ?? null)
        setCalibrationResult(result)
        return result
      }

      // Sort by display coordinates - origin should have smaller values
      uniquePoints.sort((a, b) => (a.displayX + a.displayY) - (b.displayX + b.displayY))

      const originPoint = uniquePoints[0]
      const unitPoint = uniquePoints[1]

      // Validate they're not on the same axis
      const dx = unitPoint.displayX - originPoint.displayX
      const dy = unitPoint.displayY - originPoint.displayY

      if (Math.abs(dx) < 0.0001 || Math.abs(dy) < 0.0001) {
        const result: CalibrationResult = {
          isCalibrated: false,
          scaleX: 1,
          scaleY: 1,
          offsetX: 0,
          offsetY: 0,
          error: 'Calibration points must be diagonal (not on same axis)',
        }
        setCalibrationChecked(true)
        setIsCalibrated(false)
        setCalibrationError(result.error ?? null)
        setCalibrationResult(result)
        return result
      }

      // Calculate transform: dwg = scale * display + offset
      // Using expected DWG coords: origin (0,0) and unit (1,1)
      const scaleX = (EXPECTED_UNIT.x - EXPECTED_ORIGIN.x) / dx
      const scaleY = (EXPECTED_UNIT.y - EXPECTED_ORIGIN.y) / dy
      const offsetX = EXPECTED_ORIGIN.x - scaleX * originPoint.displayX
      const offsetY = EXPECTED_ORIGIN.y - scaleY * originPoint.displayY

      const result: CalibrationResult = {
        isCalibrated: true,
        scaleX,
        scaleY,
        offsetX,
        offsetY,
      }

      console.log('[Calibration] Found calibration points:', {
        origin: { display: { x: originPoint.displayX, y: originPoint.displayY }, dwg: EXPECTED_ORIGIN },
        unit: { display: { x: unitPoint.displayX, y: unitPoint.displayY }, dwg: EXPECTED_UNIT },
        transform: { scaleX, scaleY, offsetX, offsetY },
      })

      setCalibrationChecked(true)
      setIsCalibrated(true)
      setCalibrationError(null)
      setCalibrationResult(result)
      return result
    } catch (err) {
      const result: CalibrationResult = {
        isCalibrated: false,
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
        error: `Calibration detection failed: ${err instanceof Error ? err.message : String(err)}`,
      }
      setCalibrationChecked(true)
      setIsCalibrated(false)
      setCalibrationError(result.error ?? null)
      setCalibrationResult(result)
      return result
    }
  }, [viewerRef, findCalibrationPoints])

  /**
   * Get current calibration values
   */
  const getCalibration = useCallback((): CalibrationResult | null => {
    return calibrationResult
  }, [calibrationResult])

  return {
    calibrationChecked,
    isCalibrated,
    calibrationError,
    detectCalibration,
    getCalibration,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Promisified version of model.getProperties
 */
function getPropertiesAsync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  dbId: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  return new Promise((resolve) => {
    model.getProperties(
      dbId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result: any) => resolve(result),
      () => resolve(null)
    )
  })
}

/**
 * Get display coordinates of a point from the vertex buffer
 *
 * APS Viewer stores 2D geometry in a shared vertex buffer. Each vertex has
 * XY coordinates and a dbId. We find vertices belonging to our point's dbId.
 */
function getPointDisplayCoords(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  targetDbId: number
): { x: number; y: number } | null {
  try {
    const fragList = model.getFragmentList?.()
    if (!fragList) return null

    // 2D DWGs typically have geometry in fragment 0
    const geom = fragList.getGeometry?.(0)
    if (!geom?.vb) return null

    const vb = geom.vb as Float32Array
    const stride = geom.vbstride || 10

    // Get dbId byte offset from attributes
    const dbIdOffset = geom.attributes?.dbId4b?.offset ?? 7

    // Convert to byte view for dbId extraction (stored as 4 bytes)
    const bytes = new Uint8Array(vb.buffer, vb.byteOffset, vb.byteLength)
    const strideBytes = stride * 4
    const dbIdByteOffset = dbIdOffset * 4

    // Search for vertex with matching dbId
    const vertexCount = Math.floor(vb.length / stride)
    for (let i = 0; i < vertexCount; i++) {
      const base = i * strideBytes

      // Extract dbId from 4 bytes (little-endian)
      const b0 = bytes[base + dbIdByteOffset]
      const b1 = bytes[base + dbIdByteOffset + 1]
      const b2 = bytes[base + dbIdByteOffset + 2]
      const b3 = bytes[base + dbIdByteOffset + 3]
      const dbId = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)

      if (dbId === targetDbId) {
        // Found it - X and Y are at start of vertex
        const x = vb[i * stride]
        const y = vb[i * stride + 1]
        return { x, y }
      }
    }

    return null
  } catch {
    return null
  }
}
