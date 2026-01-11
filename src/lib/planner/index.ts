/**
 * Planner Library
 *
 * APS integration for floor plan viewing with persistent storage
 */

// Server-side service (for API routes)
export {
  getAccessToken,
  getViewerToken,
  generateBucketName,
  ensureProjectBucketExists,
  deleteProjectBucket,
  calculateFileHash,
  uploadFloorPlan,
  translateToSVF2,
  getTranslationStatus,
  prepareFloorPlan,
  // Template management
  TEMPLATE_OBJECT_KEY,
  TEMP_PREFIX,
  uploadTemplateToProjectBucket,
  hasTemplateInBucket,
  deleteTemplateFromBucket,
  generateSignedReadUrl,
  generateSignedWriteUrl,
  cleanupTempFiles,
  uploadBufferToOss,
  deriveUrn
} from './aps-planner-service'

export type { PrepareFloorPlanResult } from './aps-planner-service'

// Server actions (for components)
export {
  getProjectFloorPlan,
  uploadFloorPlanAction,
  getFloorPlanTranslationStatus,
  getFloorPlanViewerToken,
  clearProjectFloorPlan,
  deleteProjectOssBucket
} from './actions'

export type {
  FloorPlanInfo,
  UploadResult,
  TranslationStatusResult
} from './actions'
