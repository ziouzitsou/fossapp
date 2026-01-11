/**
 * Planner Library
 *
 * APS integration for floor plan viewing with persistent storage.
 *
 * Module structure:
 * - auth.ts: APS authentication and token management
 * - oss-service.ts: Object Storage Service operations
 * - translation-service.ts: Model Derivative translation
 * - manifest-service.ts: Manifest parsing and thumbnails
 * - workflow.ts: Main orchestration (prepareFloorPlan)
 *
 * @module planner
 */

// ============================================================================
// AUTHENTICATION
// ============================================================================

export { getAccessToken, getViewerToken } from './auth'

// ============================================================================
// OSS SERVICE
// ============================================================================

export {
  // Constants
  TEMPLATE_OBJECT_KEY,
  TEMP_PREFIX,
  // Bucket management
  generateBucketName,
  ensureProjectBucketExists,
  deleteProjectBucket,
  // Template management
  uploadTemplateToProjectBucket,
  hasTemplateInBucket,
  deleteTemplateFromBucket,
  // Signed URLs
  generateSignedReadUrl,
  generateSignedWriteUrl,
  // Object operations
  uploadBufferToOss,
  cleanupTempFiles,
  deleteFloorPlanObject,
  deleteDerivatives,
  listBucketDWGs,
  // URN utilities
  deriveUrn,
  parseUrnToObjectKey,
  // File operations
  generateObjectKey,
  calculateFileHash,
  uploadFloorPlan,
  copyFloorPlanInBucket
} from './oss-service'

// ============================================================================
// TRANSLATION SERVICE
// ============================================================================

export { translateToSVF2, getTranslationStatus } from './translation-service'

// ============================================================================
// MANIFEST SERVICE
// ============================================================================

export { getManifestData, getThumbnailBase64 } from './manifest-service'
export type { ManifestData } from './manifest-service'

// ============================================================================
// WORKFLOW
// ============================================================================

export { prepareFloorPlan } from './workflow'
export type { PrepareFloorPlanResult } from './workflow'

// ============================================================================
// SERVER ACTIONS
// ============================================================================

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
