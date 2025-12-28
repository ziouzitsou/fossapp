/**
 * APS Design Automation Types
 * Shared type definitions for the APS service modules
 */

export interface ProcessingLog {
  timestamp: string
  step: string
  status: 'started' | 'completed' | 'error' | 'info'
  details?: Record<string, unknown>
}

export interface FileUploadResult {
  type: 'script' | 'image'
  objectKey: string
  bucketKey: string
  size: number
  downloadUrl: string
  originalName?: string
  index?: number
}

export interface WorkItemResult {
  workItemId: string
  status: string
  reportUrl: string | null
}

export interface DWGResult {
  dwgUrl: string
  dwgBuffer?: Buffer
  report?: string
  message: string
  size?: number
}

export interface TileProcessingResult {
  success: boolean
  tileName: string
  workItemId: string
  dwgUrl: string
  dwgBuffer?: Buffer
  /** URN for Autodesk Viewer (SVF translation started automatically) */
  viewerUrn?: string
  processingLogs: ProcessingLog[]
  workItemReport?: string
  message: string
  errors: string[]
}
