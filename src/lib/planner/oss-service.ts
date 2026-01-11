/**
 * APS Object Storage Service (OSS)
 *
 * Handles all bucket and object operations for the Planner feature:
 * - PERSISTENT buckets (one per project, never expires)
 * - File uploads, downloads, copies, and deletions
 * - Signed URL generation for Design Automation
 * - URN derivation and parsing
 *
 * Bucket naming: fossapp_prj_{short_project_id}
 * (lowercase, underscores only, globally unique)
 *
 * @module planner/oss-service
 */

import { Region, PolicyKey } from '@aps_sdk/oss'
import crypto from 'crypto'
import { getAccessToken, ossClient } from './auth'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Template object key in project buckets */
export const TEMPLATE_OBJECT_KEY = 'FOSS.dwt'

/** Temp files prefix for DA processing */
export const TEMP_PREFIX = '_temp'

// ============================================================================
// BUCKET MANAGEMENT
// ============================================================================

/**
 * Generate bucket name from project ID
 * Format: fossapp_prj_{first 12 chars of UUID without hyphens}
 *
 * Bucket naming rules:
 * - 3-128 characters
 * - Lowercase only (a-z, 0-9, underscore)
 * - Globally unique across all Autodesk users
 *
 * @param projectId - Project UUID
 * @returns Bucket name string
 */
export function generateBucketName(projectId: string): string {
  const shortId = projectId.replace(/-/g, '').substring(0, 12).toLowerCase()
  return `fossapp_prj_${shortId}`
}

/**
 * Ensure project bucket exists (PERSISTENT policy)
 * Creates if not exists, returns bucket name
 *
 * @param projectId - Project UUID
 * @returns Bucket name
 */
export async function ensureProjectBucketExists(projectId: string): Promise<string> {
  const accessToken = await getAccessToken()
  const bucketName = generateBucketName(projectId)

  try {
    await ossClient.getBucketDetails(bucketName, { accessToken })
    console.log(`[Planner] Bucket exists: ${bucketName}`)
  } catch (err: unknown) {
    const error = err as { axiosError?: { response?: { status?: number } } }
    if (error.axiosError?.response?.status === 404) {
      await ossClient.createBucket(
        Region.Emea,
        { bucketKey: bucketName, policyKey: PolicyKey.Persistent },
        { accessToken }
      )
      console.log(`[Planner] Created persistent bucket: ${bucketName}`)
    } else {
      throw err
    }
  }

  return bucketName
}

/**
 * Delete project bucket and all its contents
 * Called when a project is deleted
 *
 * @param projectId - Project UUID
 */
export async function deleteProjectBucket(projectId: string): Promise<void> {
  const accessToken = await getAccessToken()
  const bucketName = generateBucketName(projectId)

  try {
    const objects = await ossClient.getObjects(bucketName, { accessToken })

    if (objects.items && objects.items.length > 0) {
      console.log(`[Planner] Deleting ${objects.items.length} objects from bucket ${bucketName}`)
      for (const obj of objects.items) {
        if (obj.objectKey) {
          await ossClient.deleteObject(bucketName, obj.objectKey, { accessToken })
        }
      }
    }

    await ossClient.deleteBucket(bucketName, { accessToken })
    console.log(`[Planner] Deleted bucket: ${bucketName}`)
  } catch (err: unknown) {
    const error = err as { axiosError?: { response?: { status?: number } } }
    if (error.axiosError?.response?.status === 404) {
      console.log(`[Planner] Bucket not found (already deleted?): ${bucketName}`)
    } else {
      console.error(`[Planner] Error deleting bucket ${bucketName}:`, err)
      throw err
    }
  }
}

// ============================================================================
// TEMPLATE MANAGEMENT
// ============================================================================

/**
 * Upload FOSS.dwt template to a project bucket
 * Called during project creation to pre-stage the template
 *
 * @param bucketName - Target bucket name
 * @param templateBuffer - FOSS.dwt file buffer
 */
export async function uploadTemplateToProjectBucket(
  bucketName: string,
  templateBuffer: Buffer
): Promise<void> {
  const accessToken = await getAccessToken()

  await ossClient.uploadObject(
    bucketName,
    TEMPLATE_OBJECT_KEY,
    templateBuffer,
    { accessToken }
  )

  console.log(`[Planner] Template uploaded to ${bucketName}/${TEMPLATE_OBJECT_KEY}`)
}

/**
 * Check if template exists in a project bucket
 *
 * @param bucketName - Bucket name
 * @returns True if template exists
 */
export async function hasTemplateInBucket(bucketName: string): Promise<boolean> {
  const accessToken = await getAccessToken()

  try {
    await ossClient.getObjectDetails(bucketName, TEMPLATE_OBJECT_KEY, { accessToken })
    return true
  } catch (err: unknown) {
    const error = err as { axiosError?: { response?: { status?: number } } }
    if (error.axiosError?.response?.status === 404) {
      return false
    }
    throw err
  }
}

/**
 * Delete template from a project bucket (for forcing refresh)
 *
 * @param bucketName - Bucket name
 * @returns True if deleted, false if not found
 */
export async function deleteTemplateFromBucket(bucketName: string): Promise<boolean> {
  const accessToken = await getAccessToken()

  try {
    await ossClient.deleteObject(bucketName, TEMPLATE_OBJECT_KEY, { accessToken })
    console.log(`[Planner] Template deleted from ${bucketName}`)
    return true
  } catch (err: unknown) {
    const error = err as { axiosError?: { response?: { status?: number } } }
    if (error.axiosError?.response?.status === 404) {
      console.log(`[Planner] Template not found in ${bucketName} (already deleted)`)
      return false
    }
    throw err
  }
}

// ============================================================================
// SIGNED URL GENERATION
// ============================================================================

/**
 * Generate a signed URL for reading an object from OSS
 * Valid for 60 minutes
 *
 * IMPORTANT: Uses OSS signed URL with read access, NOT S3-compatible URLs.
 * Design Automation requires OSS signed URLs format.
 *
 * @param bucketName - Bucket name
 * @param objectKey - Object key
 * @returns Signed URL string
 */
export async function generateSignedReadUrl(
  bucketName: string,
  objectKey: string
): Promise<string> {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects/${encodeURIComponent(objectKey)}/signed?access=read`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ minutesExpiration: 60 }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to generate signed read URL: ${response.status} - ${errorText}`)
  }

  const data = await response.json() as { signedUrl: string }
  return data.signedUrl
}

/**
 * Generate a signed URL for writing an object to OSS
 * Valid for 60 minutes
 *
 * IMPORTANT: Uses OSS signed URL with readwrite access, NOT S3-compatible URLs.
 * Design Automation requires OSS signed URLs format.
 *
 * @param bucketName - Bucket name
 * @param objectKey - Object key
 * @returns Signed URL string
 */
export async function generateSignedWriteUrl(
  bucketName: string,
  objectKey: string
): Promise<string> {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects/${encodeURIComponent(objectKey)}/signed?access=readwrite`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ minutesExpiration: 60 }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to generate signed write URL: ${response.status} - ${errorText}`)
  }

  const data = await response.json() as { signedUrl: string }
  return data.signedUrl
}

// ============================================================================
// OBJECT OPERATIONS
// ============================================================================

/**
 * Upload a buffer to OSS bucket
 * Returns signed URL for reading
 *
 * @param bucketName - Bucket name
 * @param objectKey - Object key
 * @param buffer - File buffer
 * @returns Signed read URL
 */
export async function uploadBufferToOss(
  bucketName: string,
  objectKey: string,
  buffer: Buffer
): Promise<string> {
  const accessToken = await getAccessToken()

  await ossClient.uploadObject(
    bucketName,
    objectKey,
    buffer,
    { accessToken }
  )

  return generateSignedReadUrl(bucketName, objectKey)
}

/**
 * Delete temporary files from bucket after DA processing
 * Cleans up: input.dwg and import.scr from _temp/{sessionId}/
 *
 * @param bucketName - Bucket name
 * @param sessionId - Session ID for temp folder
 */
export async function cleanupTempFiles(
  bucketName: string,
  sessionId: string
): Promise<void> {
  const accessToken = await getAccessToken()
  const prefix = `${TEMP_PREFIX}/${sessionId}`

  const filesToDelete = [
    `${prefix}/input.dwg`,
    `${prefix}/import.scr`
  ]

  for (const objectKey of filesToDelete) {
    try {
      await ossClient.deleteObject(bucketName, objectKey, { accessToken })
      console.log(`[Planner] Deleted temp file: ${objectKey}`)
    } catch (err: unknown) {
      const error = err as { axiosError?: { response?: { status?: number } } }
      if (error.axiosError?.response?.status !== 404) {
        console.warn(`[Planner] Failed to delete ${objectKey}:`, err)
      }
    }
  }
}

/**
 * Delete a single object from the bucket
 * Used when removing a floor plan from an area version
 *
 * @param bucketName - OSS bucket name
 * @param objectKey - Object key within bucket
 */
export async function deleteFloorPlanObject(
  bucketName: string,
  objectKey: string
): Promise<void> {
  const accessToken = await getAccessToken()

  try {
    await ossClient.deleteObject(bucketName, objectKey, { accessToken })
    console.log(`[Planner] Deleted object: ${objectKey} from ${bucketName}`)
  } catch (err: unknown) {
    const error = err as { axiosError?: { response?: { status?: number } } }
    if (error.axiosError?.response?.status === 404) {
      console.log(`[Planner] Object not found (already deleted?): ${objectKey}`)
    } else {
      console.error(`[Planner] Error deleting object ${objectKey}:`, err)
      throw err
    }
  }
}

/**
 * Delete Model Derivative manifest and all derivatives (SVF2, thumbnails, etc.)
 *
 * IMPORTANT: Derivatives are stored separately from OSS and persist forever
 * until explicitly deleted. Always call this when deleting floor plans.
 *
 * @param urn - Base64-encoded URN
 * @see https://aps.autodesk.com/en/docs/model-derivative/v2/reference/http/urn-manifest-DELETE/
 */
export async function deleteDerivatives(urn: string): Promise<void> {
  if (!urn) {
    console.log('[Planner] No URN provided, skipping derivative deletion')
    return
  }

  const accessToken = await getAccessToken()

  try {
    const response = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/regions/eu/designdata/${urn}/manifest`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (response.ok || response.status === 202) {
      console.log(`[Planner] Deleted derivatives for URN: ${urn.substring(0, 30)}...`)
    } else if (response.status === 404) {
      console.log(`[Planner] Derivatives not found (already deleted?): ${urn.substring(0, 30)}...`)
    } else {
      const errorText = await response.text()
      console.warn(`[Planner] Failed to delete derivatives: ${response.status} - ${errorText}`)
    }
  } catch (err) {
    console.warn('[Planner] Error deleting derivatives:', err)
  }
}

/**
 * List DWG files in a project's OSS bucket
 * Returns files with derived URNs for direct viewer loading
 *
 * @param projectId - Project UUID
 * @param options - Optional filters
 * @returns Array of file info with URNs
 */
export async function listBucketDWGs(
  projectId: string,
  options?: {
    prefix?: string
    areaId?: string      // Legacy - ignored
    versionId?: string   // Legacy - ignored
  }
): Promise<Array<{
  fileName: string
  objectKey: string
  size: number
  uploadedAt: string
  urn: string
}>> {
  const accessToken = await getAccessToken()
  const bucketName = generateBucketName(projectId)

  try {
    const objects = await ossClient.getObjects(bucketName, { accessToken })

    if (!objects.items || objects.items.length === 0) {
      return []
    }

    return objects.items
      .filter(obj => {
        if (!obj.objectKey?.toLowerCase().endsWith('.dwg')) return false
        if (options?.prefix && !obj.objectKey.startsWith(options.prefix)) return false
        return true
      })
      .map(obj => ({
        fileName: obj.objectKey || '',
        objectKey: obj.objectKey || '',
        size: obj.size || 0,
        uploadedAt: obj.location || new Date().toISOString(),
        urn: deriveUrn(bucketName, obj.objectKey || '')
      }))
  } catch (err: unknown) {
    const error = err as { axiosError?: { response?: { status?: number } } }
    if (error.axiosError?.response?.status === 404) {
      return []
    }
    throw err
  }
}

// ============================================================================
// URN UTILITIES
// ============================================================================

/**
 * Derive URN from bucket name and object key
 * URN = base64(urn:adsk.objects:os.object:{bucketKey}/{objectKey}) without padding
 *
 * @param bucketName - Bucket name
 * @param objectKey - Object key
 * @returns Base64-encoded URN
 */
export function deriveUrn(bucketName: string, objectKey: string): string {
  const objectId = `urn:adsk.objects:os.object:${bucketName}/${objectKey}`
  return Buffer.from(objectId).toString('base64').replace(/=/g, '')
}

/**
 * Extract bucket name and object key from a base64-encoded URN
 *
 * URN format: urn:adsk.objects:os.object:{bucketKey}/{objectKey}
 *
 * @param urn - Base64-encoded URN (no padding)
 * @returns Object with bucketKey and objectKey, or null if invalid
 */
export function parseUrnToObjectKey(urn: string): { bucketKey: string; objectKey: string } | null {
  try {
    const paddedUrn = urn + '='.repeat((4 - (urn.length % 4)) % 4)
    const decoded = Buffer.from(paddedUrn, 'base64').toString('utf-8')

    const match = decoded.match(/^urn:adsk\.objects:os\.object:([^/]+)\/(.+)$/)
    if (!match) {
      console.warn('[Planner] Invalid URN format:', decoded)
      return null
    }

    return {
      bucketKey: match[1],
      objectKey: match[2]
    }
  } catch (error) {
    console.error('[Planner] Failed to parse URN:', error)
    return null
  }
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Generate structured object key for architect floor plan storage
 *
 * Pattern: {projectCode}_{areaCode}_v{revision}_{timestamp}_ARCH.dwg
 *
 * @param projectCode - Project code (e.g., "PRJ001")
 * @param areaCode - Area code (e.g., "A01")
 * @param revisionNumber - Revision number (e.g., 1)
 * @returns Structured object key for OSS storage
 */
export function generateObjectKey(
  projectCode: string,
  areaCode: string,
  revisionNumber: number
): string {
  const safeProjectCode = projectCode.replace(/[^a-zA-Z0-9]/g, '_')
  const safeAreaCode = areaCode.replace(/[^a-zA-Z0-9]/g, '_')
  const timestamp = Date.now()
  return `${safeProjectCode}_${safeAreaCode}_v${revisionNumber}_${timestamp}_ARCH.dwg`
}

/**
 * Calculate SHA256 hash of file buffer
 *
 * @param buffer - File buffer
 * @returns Hex-encoded hash string
 */
export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Upload DWG to project bucket
 *
 * @param bucketName - OSS bucket name
 * @param objectKey - Object key
 * @param fileBuffer - File content
 * @returns Object ID and URN
 */
export async function uploadFloorPlan(
  bucketName: string,
  objectKey: string,
  fileBuffer: Buffer
): Promise<{ objectId: string; urn: string }> {
  const accessToken = await getAccessToken()

  const result = await ossClient.uploadObject(
    bucketName,
    objectKey,
    fileBuffer,
    { accessToken }
  )

  if (!result.objectId) {
    throw new Error('Upload failed: no objectId returned')
  }

  const urn = Buffer.from(result.objectId).toString('base64').replace(/=/g, '')

  console.log(`[Planner] Uploaded ${objectKey} to ${bucketName}, URN: ${urn.substring(0, 20)}...`)

  return {
    objectId: result.objectId,
    urn
  }
}

/**
 * Copy a DWG file within the same bucket
 * Used when creating a new area version with copy_from_version
 *
 * Note: APS OSS doesn't have a native copy operation, so we download and re-upload.
 *
 * @param bucketName - Bucket name
 * @param sourceObjectKey - Source object key
 * @param targetObjectKey - Target object key
 * @returns Object ID and URN of the copy
 */
export async function copyFloorPlanInBucket(
  bucketName: string,
  sourceObjectKey: string,
  targetObjectKey: string
): Promise<{ objectId: string; urn: string }> {
  const accessToken = await getAccessToken()

  const downloadUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${encodeURIComponent(bucketName)}/objects/${encodeURIComponent(sourceObjectKey)}`

  const downloadResponse = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!downloadResponse.ok) {
    const errorText = await downloadResponse.text()
    throw new Error(`Failed to download source file: ${downloadResponse.status} - ${errorText}`)
  }

  const arrayBuffer = await downloadResponse.arrayBuffer()
  const fileBuffer = Buffer.from(arrayBuffer)

  console.log(`[Planner] Downloaded ${sourceObjectKey} (${fileBuffer.length} bytes) for copy`)

  return uploadFloorPlan(bucketName, targetObjectKey, fileBuffer)
}
