/**
 * APS Planner Service
 *
 * Handles floor plan viewing for the Planner feature:
 * - PERSISTENT buckets (one per project, never expires)
 * - File hash caching to avoid re-translation
 * - Database integration for URN storage
 *
 * Bucket naming: fossapp_prj_{short_project_id}
 * (lowercase, underscores only, globally unique)
 */

import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager'
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication'
import { OssClient, Region, PolicyKey } from '@aps_sdk/oss'
import crypto from 'crypto'

// Configuration
const APS_CLIENT_ID = process.env.APS_CLIENT_ID!
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET!

// SDK Manager singleton
const sdkManager = SdkManagerBuilder.create().build()

// Client singletons
const authClient = new AuthenticationClient({ sdkManager })
const ossClient = new OssClient({ sdkManager })

// Token cache
let tokenCache: { accessToken: string; expiresAt: number } | null = null

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Get full access token (server-to-server)
 * Cached until 5 minutes before expiration
 */
export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokenCache.accessToken
  }

  const credentials = await authClient.getTwoLeggedToken(
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    [
      Scopes.DataRead,
      Scopes.DataWrite,
      Scopes.DataCreate,
      Scopes.BucketCreate,
      Scopes.BucketRead,
      Scopes.BucketDelete,
      Scopes.ViewablesRead
    ]
  )

  tokenCache = {
    accessToken: credentials.access_token,
    expiresAt: Date.now() + (credentials.expires_in * 1000)
  }

  return credentials.access_token
}

/**
 * Get viewer-only token for client-side viewer
 */
export async function getViewerToken(): Promise<{ access_token: string; expires_in: number }> {
  const credentials = await authClient.getTwoLeggedToken(
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    [Scopes.DataRead, Scopes.ViewablesRead]
  )

  return {
    access_token: credentials.access_token,
    expires_in: credentials.expires_in
  }
}

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
 */
export function generateBucketName(projectId: string): string {
  // Remove hyphens and take first 12 characters for uniqueness
  const shortId = projectId.replace(/-/g, '').substring(0, 12).toLowerCase()
  return `fossapp_prj_${shortId}`
}

/**
 * Ensure project bucket exists (PERSISTENT policy)
 * Creates if not exists, returns bucket name
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
      // Create PERSISTENT bucket (files never expire)
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
 * Derive URN from bucket name and object key
 * URN = base64(urn:adsk.objects:os.object:{bucketKey}/{objectKey}) without padding
 */
export function deriveUrn(bucketName: string, objectKey: string): string {
  const objectId = `urn:adsk.objects:os.object:${bucketName}/${objectKey}`
  return Buffer.from(objectId).toString('base64').replace(/=/g, '')
}

/**
 * List DWG files in a project's OSS bucket
 * Returns files with derived URNs for direct viewer loading
 */
export async function listBucketDWGs(projectId: string): Promise<Array<{
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

    // Filter to only DWG files and map to our format with derived URNs
    return objects.items
      .filter(obj => obj.objectKey?.toLowerCase().endsWith('.dwg'))
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
      // Bucket doesn't exist yet
      return []
    }
    throw err
  }
}

/**
 * Delete project bucket and all its contents
 * Called when a project is deleted
 */
export async function deleteProjectBucket(projectId: string): Promise<void> {
  const accessToken = await getAccessToken()
  const bucketName = generateBucketName(projectId)

  try {
    // First, list and delete all objects in the bucket
    const objects = await ossClient.getObjects(bucketName, { accessToken })

    if (objects.items && objects.items.length > 0) {
      console.log(`[Planner] Deleting ${objects.items.length} objects from bucket ${bucketName}`)
      for (const obj of objects.items) {
        if (obj.objectKey) {
          await ossClient.deleteObject(bucketName, obj.objectKey, { accessToken })
        }
      }
    }

    // Then delete the bucket
    await ossClient.deleteBucket(bucketName, { accessToken })
    console.log(`[Planner] Deleted bucket: ${bucketName}`)
  } catch (err: unknown) {
    const error = err as { axiosError?: { response?: { status?: number } } }
    if (error.axiosError?.response?.status === 404) {
      // Bucket doesn't exist, nothing to delete
      console.log(`[Planner] Bucket not found (already deleted?): ${bucketName}`)
    } else {
      console.error(`[Planner] Error deleting bucket ${bucketName}:`, err)
      throw err
    }
  }
}

// ============================================================================
// FILE HANDLING
// ============================================================================

/**
 * Calculate SHA256 hash of file buffer
 */
export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Upload DWG to project bucket
 */
export async function uploadFloorPlan(
  bucketName: string,
  fileName: string,
  fileBuffer: Buffer
): Promise<{ objectId: string; urn: string }> {
  const accessToken = await getAccessToken()

  // Use original filename (no timestamp needed - persistent storage)
  const result = await ossClient.uploadObject(
    bucketName,
    fileName,
    fileBuffer,
    { accessToken }
  )

  if (!result.objectId) {
    throw new Error('Upload failed: no objectId returned')
  }

  // Create base64-encoded URN (without padding)
  const urn = Buffer.from(result.objectId).toString('base64').replace(/=/g, '')

  console.log(`[Planner] Uploaded ${fileName} to ${bucketName}, URN: ${urn.substring(0, 20)}...`)

  return {
    objectId: result.objectId,
    urn
  }
}

// ============================================================================
// TRANSLATION
// ============================================================================

/**
 * Start SVF2 translation job
 * Uses EMEA endpoint since our buckets are in EMEA region
 */
export async function translateToSVF2(urn: string): Promise<{ status: string }> {
  const accessToken = await getAccessToken()

  const response = await fetch(
    'https://developer.api.autodesk.com/modelderivative/v2/regions/eu/designdata/job',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-force': 'true',
      },
      body: JSON.stringify({
        input: { urn },
        output: {
          formats: [{
            type: 'svf2',
            views: ['2d', '3d']
          }]
        }
      }),
    }
  )

  if (!response.ok && response.status !== 409) {
    const errorText = await response.text()
    throw new Error(`Translation job failed: ${response.status} - ${errorText}`)
  }

  const result = await response.json() as { result?: string }

  console.log(`[Planner] Translation started for URN: ${urn.substring(0, 20)}...`)

  return {
    status: result.result || 'created'
  }
}

/**
 * Get translation status
 */
export async function getTranslationStatus(urn: string): Promise<{
  status: 'pending' | 'inprogress' | 'success' | 'failed'
  progress: string
  messages?: string[]
}> {
  const accessToken = await getAccessToken()

  try {
    const response = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/regions/eu/designdata/${urn}/manifest`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return { status: 'pending', progress: '0%' }
      }
      const errorText = await response.text()
      throw new Error(`Failed to get manifest: ${response.status} - ${errorText}`)
    }

    const manifest = await response.json() as {
      status: string
      progress?: string
      derivatives?: Array<{
        messages?: Array<{ message?: string } | string>
        progress?: string
      }>
    }

    const messages: string[] = []
    if (manifest.derivatives) {
      for (const derivative of manifest.derivatives) {
        if (derivative.messages) {
          for (const msg of derivative.messages) {
            if (typeof msg === 'object' && msg !== null && 'message' in msg) {
              messages.push(msg.message as string)
            }
          }
        }
      }
    }

    // Normalize progress to always include a percentage
    let progress = manifest.progress || '0%'
    if (progress === 'complete') {
      progress = '100% complete'
    }

    return {
      status: manifest.status as 'pending' | 'inprogress' | 'success' | 'failed',
      progress,
      messages: messages.length > 0 ? messages : undefined
    }
  } catch (err) {
    if (err instanceof Error) throw err
    throw new Error('Unknown error getting translation status')
  }
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================

export interface PrepareFloorPlanResult {
  urn: string
  bucketName: string
  fileHash: string
  isNewUpload: boolean
}

/**
 * Prepare floor plan for viewing
 *
 * 1. Calculate file hash
 * 2. Check if already translated (via callback)
 * 3. If not, upload and translate
 * 4. Return URN for viewer
 *
 * @param projectId - Project UUID
 * @param fileName - Original filename
 * @param fileBuffer - DWG file content
 * @param checkCache - Callback to check database for existing URN by hash
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
