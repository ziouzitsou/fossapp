/**
 * Planner Page Types
 */

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
