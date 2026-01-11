/**
 * APS Planner Workflow
 *
 * Main orchestration for floor plan preparation:
 * - Hash-based caching to avoid re-translation
 * - Bucket management
 * - Upload and translation coordination
 *
 * @module planner/workflow
 */

import {
  generateBucketName,
  ensureProjectBucketExists,
  calculateFileHash,
  uploadFloorPlan
} from './oss-service'
import { translateToSVF2 } from './translation-service'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of floor plan preparation
 */
export interface PrepareFloorPlanResult {
  /** Base64-encoded URN for viewer */
  urn: string
  /** OSS bucket name */
  bucketName: string
  /** SHA256 hash of the file */
  fileHash: string
  /** Whether this was a new upload (vs cache hit) */
  isNewUpload: boolean
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================

/**
 * Prepare floor plan for viewing
 *
 * Workflow:
 * 1. Calculate file hash
 * 2. Check if already translated (via callback)
 * 3. If not, upload and translate
 * 4. Return URN for viewer
 *
 * @param projectId - Project UUID
 * @param fileName - Original filename
 * @param fileBuffer - DWG file content
 * @param checkCache - Callback to check database for existing URN by hash
 * @returns URN, bucket name, hash, and whether it was a new upload
 */
export async function prepareFloorPlan(
  projectId: string,
  fileName: string,
  fileBuffer: Buffer,
  checkCache?: (hash: string) => Promise<string | null>
): Promise<PrepareFloorPlanResult> {
  // Step 1: Calculate hash
  const fileHash = calculateFileHash(fileBuffer)
  console.log(`[Planner] File hash: ${fileHash.substring(0, 16)}...`)

  // Step 2: Check cache (if callback provided)
  if (checkCache) {
    const cachedUrn = await checkCache(fileHash)
    if (cachedUrn) {
      console.log(`[Planner] Cache hit! Using existing URN`)
      return {
        urn: cachedUrn,
        bucketName: generateBucketName(projectId),
        fileHash,
        isNewUpload: false
      }
    }
  }

  // Step 3: Ensure bucket exists
  const bucketName = await ensureProjectBucketExists(projectId)

  // Step 4: Upload file
  const { urn } = await uploadFloorPlan(bucketName, fileName, fileBuffer)

  // Step 5: Start translation
  await translateToSVF2(urn)

  return {
    urn,
    bucketName,
    fileHash,
    isNewUpload: true
  }
}
