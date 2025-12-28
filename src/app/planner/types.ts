/**
 * Planner Page Types
 */

/** Area-version selection option for floor plan management */
export interface AreaVersionOption {
  areaId: string
  areaCode: string
  areaName: string
  versionId: string
  versionNumber: number
  floorPlanUrn?: string
  floorPlanFilename?: string
  floorPlanStatus?: string
  floorPlanWarnings?: number
}
