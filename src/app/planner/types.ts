/**
 * Planner Page Types
 */

import type { usePlannerState } from './use-planner-state'

/** Return type of usePlannerState hook - used by extracted components */
export type PlannerState = ReturnType<typeof usePlannerState>

/** Area-revision selection option for floor plan management */
export interface AreaRevisionOption {
  areaId: string
  areaCode: string
  areaName: string
  revisionId: string
  revisionNumber: number
  floorPlanUrn?: string
  floorPlanFilename?: string
  floorPlanStatus?: string
  floorPlanWarnings?: number
}

/** @deprecated Use AreaRevisionOption instead */
export type AreaVersionOption = AreaRevisionOption
