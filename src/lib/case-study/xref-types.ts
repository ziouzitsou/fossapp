/**
 * XREF Generator Types
 *
 * Type definitions for the Case Study XREF DWG generation system.
 *
 * @module case-study/xref-types
 */

/**
 * Request to generate XREF DWG
 */
export interface GenerateXrefRequest {
  /** Area revision ID containing placements */
  areaRevisionId: string
  /** Project ID for bucket naming */
  projectId: string
  /** Project code for output naming (e.g., "2512_001") */
  projectCode: string
  /** Area code for output naming (e.g., "F1") */
  areaCode: string
  /** Revision number for output naming */
  revisionNumber: number
  /** Project's existing OSS bucket name */
  ossBucket: string
  /** Floor plan URN already in OSS */
  floorPlanUrn: string
  /** Google Drive v{n} folder ID for output upload (null = skip Drive upload) */
  driveFolderId: string | null
}

/**
 * Placement data from database
 */
export interface PlacementData {
  id: string
  project_product_id: string
  product_id: string
  world_x: number
  world_y: number
  rotation: number
  mirror_x: boolean
  mirror_y: boolean
  symbol: string | null
  foss_pid?: string
}

/**
 * Symbol info for a unique product
 */
export interface SymbolInfo {
  fossPid: string
  localPath: string
  supabaseUrl: string | null // null = use placeholder
  hasDwg: boolean
}

/**
 * Generation result
 */
export interface GenerateXrefResult {
  success: boolean
  outputDwgBuffer?: Buffer
  outputFilename?: string
  driveLink?: string
  missingSymbols?: string[] // foss_pids that used placeholder
  errors: string[]
}

/**
 * Progress callback type for streaming updates
 */
export type ProgressCallback = (phase: string, message: string, detail?: string) => void

/**
 * Upload result with URLs for WorkItem submission
 */
export interface WorkItemUploadResult {
  floorPlanUrl: string
  scriptUrl: string
  outputUrl: string
  symbolUrls: Map<string, string>
}
