/**
 * APS Design Automation Types
 *
 * Shared type definitions for the APS (Autodesk Platform Services) tile processing
 * pipeline. These types represent the workflow from script upload through DWG generation.
 *
 * @module tiles/aps/types
 * @see {@link https://aps.autodesk.com/developer/overview/design-automation-api} APS Design Automation Docs
 */

/**
 * Log entry for tile processing workflow
 *
 * @remarks
 * These logs are collected during processing and returned to the client for debugging.
 * Each step in the DA pipeline (auth, upload, workitem, download) generates entries.
 */
export interface ProcessingLog {
  /** ISO 8601 timestamp of the log entry */
  timestamp: string
  /** Processing step identifier (e.g., 'authentication', 'file_upload', 'workitem_submission') */
  step: string
  /** Current status of the step */
  status: 'started' | 'completed' | 'error' | 'info'
  /** Additional context (varies by step - may include bucket name, file sizes, etc.) */
  details?: Record<string, unknown>
}

/**
 * Result of uploading a file to OSS (Object Storage Service)
 *
 * @remarks
 * Files are uploaded via Direct-to-S3 for performance. The signed download URL
 * is used by Design Automation to fetch the file during WorkItem execution.
 */
export interface FileUploadResult {
  /** File type - 'script' for .scr files, 'image' for PNG/JPG */
  type: 'script' | 'image'
  /** Object key in OSS bucket */
  objectKey: string
  /** OSS bucket key */
  bucketKey: string
  /** File size in bytes */
  size: number
  /** Pre-signed URL for Design Automation to download the file */
  downloadUrl: string
  /** Original filename before upload (for images) */
  originalName?: string
  /** 1-based index for ordering (for images) */
  index?: number
}

/**
 * Result of submitting a WorkItem to Design Automation
 *
 * @remarks
 * WorkItems are async jobs that run AutoCAD scripts. The status progresses
 * through: pending → inprogress → success/failed
 */
export interface WorkItemResult {
  /** Unique identifier for polling status */
  workItemId: string
  /** Initial status (usually 'pending') */
  status: string
  /** URL to fetch detailed execution report */
  reportUrl: string | null
}

/**
 * Result of DWG file generation
 */
export interface DWGResult {
  /** Signed URL to download the generated DWG */
  dwgUrl: string
  /** DWG file contents (populated after download) */
  dwgBuffer?: Buffer
  /** AutoCAD execution report (useful for debugging script errors) */
  report?: string
  /** Human-readable status message */
  message: string
  /** File size in bytes */
  size?: number
}

/**
 * Complete result of tile processing through APS
 *
 * @remarks
 * This is the final return type from `processTile()` and `processTileWithProgress()`.
 * Contains the generated DWG, optional viewer URN for web preview, and full processing logs.
 *
 * The `viewerUrn` enables loading the DWG in Autodesk Viewer without download.
 * SVF2 translation is started automatically after DWG generation.
 */
export interface TileProcessingResult {
  /** Whether DWG generation succeeded */
  success: boolean
  /** Name of the tile (used in filenames) */
  tileName: string
  /** Design Automation WorkItem ID */
  workItemId: string
  /** Signed URL to download DWG (valid for ~60 minutes) */
  dwgUrl: string
  /** DWG file contents (for immediate use/storage) */
  dwgBuffer?: Buffer
  /** Base64-encoded URN for Autodesk Viewer (SVF translation started automatically) */
  viewerUrn?: string
  /** Full processing log for debugging */
  processingLogs: ProcessingLog[]
  /** AutoCAD execution report (stdout/stderr from script) */
  workItemReport?: string
  /** Human-readable status message */
  message: string
  /** Array of error messages (populated on failure) */
  errors: string[]
}
