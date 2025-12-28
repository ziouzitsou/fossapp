/**
 * APS Design Automation Module
 *
 * Barrel file exporting all APS-related functionality for tile processing.
 *
 * @example
 * import { apsService } from '@/lib/tiles/aps'
 * import type { TileProcessingResult } from '@/lib/tiles/aps'
 */

// Types
export type {
  ProcessingLog,
  FileUploadResult,
  WorkItemResult,
  DWGResult,
  TileProcessingResult,
} from './types'

// Configuration
export { APS_CONFIG, DA_BASE_URL } from './config'

// Services
export { APSAuthService } from './auth-service'
export { OSSService } from './oss-service'
export { APSDesignAutomationService } from './design-automation-service'

// Singleton instance (primary export for most use cases)
import { APSDesignAutomationService } from './design-automation-service'
export const apsService = new APSDesignAutomationService()
