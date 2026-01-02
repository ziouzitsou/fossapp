/**
 * APS Object Storage Service (OSS)
 *
 * Handles all OSS operations for tile processing:
 * - Bucket creation (transient policy, 24h auto-delete)
 * - File uploads via Direct-to-S3 (bypasses OSS for performance)
 * - Signed URL generation for DA input/output
 * - SVF2 translation triggers for viewer
 *
 * @remarks
 * Uses EMEA region for all buckets to match project requirements.
 * Transient buckets auto-delete after 24 hours, eliminating cleanup burden.
 *
 * @module tiles/aps/oss-service
 * @see {@link https://aps.autodesk.com/en/docs/data/v2/developers_guide/data-management-overview/} OSS Docs
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BucketsApi, ObjectsApi } from '@aps_sdk/oss'
import { APSAuthService } from './auth-service'
import type { FileUploadResult } from './types'

/**
 * Service for managing APS Object Storage operations
 *
 * @remarks
 * Instantiated with an APSAuthService for token management.
 * Uses both SDK APIs and direct REST calls (REST for EMEA region support).
 */
export class OSSService {
  private bucketsApi: BucketsApi
  private objectsApi: ObjectsApi
  private authService: APSAuthService

  /**
   * Create an OSS service instance
   *
   * @param authService - Authentication service for token management
   */
  constructor(authService: APSAuthService) {
    this.authService = authService
    const sdkManager = authService.getSdkManager()
    this.bucketsApi = new BucketsApi(sdkManager)
    this.objectsApi = new ObjectsApi(sdkManager)
  }

  /**
   * Generate a unique bucket name for tile processing
   *
   * @remarks
   * Format: `tile-processing-{timestamp}-{random8chars}`
   * Ensures global uniqueness across all Autodesk users.
   *
   * @returns Unique bucket name conforming to OSS naming rules (3-128 chars, lowercase)
   */
  generateBucketName(): string {
    return `tile-processing-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
  }

  /**
   * Create a temporary bucket for tile processing
   *
   * @remarks
   * Uses REST API directly instead of SDK to ensure EMEA region.
   * 'transient' policy means bucket auto-deletes after 24 hours.
   * If name collision (409), recursively retries with new name.
   *
   * @param tileName - Tile name (used for logging context only)
   * @returns The created bucket name
   * @throws Error if bucket creation fails (non-409 errors)
   */
  async createTempBucket(tileName: string): Promise<string> {
    const accessToken = await this.authService.getAccessToken()
    const bucketName = this.generateBucketName()

    try {
      const response = await fetch(
        'https://developer.api.autodesk.com/oss/v2/buckets',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-ads-region': 'EMEA',
          },
          body: JSON.stringify({
            bucketKey: bucketName,
            policyKey: 'transient',
          }),
        }
      )

      if (!response.ok) {
        if (response.status === 409) {
          // Bucket name conflict - retry with new name
          return this.createTempBucket(tileName)
        }
        const errorText = await response.text()
        throw new Error(`Bucket creation failed (${response.status}): ${errorText}`)
      }

      return bucketName
    } catch (error: any) {
      throw new Error(`Failed to create bucket: ${error.message}`)
    }
  }

  /**
   * Upload a file buffer to OSS using Direct-to-S3
   *
   * @remarks
   * Uses the 3-step Direct-to-S3 upload flow for better performance:
   * 1. Get signed S3 upload URL from OSS
   * 2. Upload directly to S3 (bypassing OSS)
   * 3. Complete upload to register object in OSS
   *
   * This is faster than uploading through OSS for files > few KB.
   *
   * @param bucketName - Target OSS bucket
   * @param fileName - Object key (filename in bucket)
   * @param buffer - File contents
   * @returns Upload result with signed download URL for DA access
   * @throws Error if any step of the upload fails
   */
  async uploadBuffer(
    bucketName: string,
    fileName: string,
    buffer: Buffer
  ): Promise<FileUploadResult> {
    const accessToken = await this.authService.getAccessToken()

    // Step 1: Get signed S3 upload URL
    const signedUrlResponse = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects/${encodeURIComponent(fileName)}/signeds3upload?parts=1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!signedUrlResponse.ok) {
      throw new Error(`Failed to get signed upload URL: ${signedUrlResponse.statusText}`)
    }

    const { uploadKey, urls } = (await signedUrlResponse.json()) as {
      uploadKey: string
      urls: string[]
    }
    const uploadUrl = urls[0]

    // Step 2: Upload to S3 (convert Buffer to Uint8Array for fetch compatibility)
    const s3Response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(buffer),
    })

    if (!s3Response.ok) {
      throw new Error(`S3 upload failed: ${s3Response.statusText}`)
    }

    const etag = s3Response.headers.get('etag') || ''

    // Step 3: Complete upload
    const completeResponse = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects/${encodeURIComponent(fileName)}/signeds3upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadKey,
          parts: [{ partNumber: 1, etag }],
        }),
      }
    )

    if (!completeResponse.ok) {
      throw new Error(`Failed to complete upload: ${completeResponse.statusText}`)
    }

    const completeData = (await completeResponse.json()) as { objectId: string; size: number }

    // Generate signed download URL for DA access
    const downloadUrl = await this.generateSignedDownloadUrl(bucketName, fileName)

    return {
      type: 'image',
      objectKey: fileName,
      bucketKey: bucketName,
      size: completeData.size,
      downloadUrl,
    }
  }

  /**
   * Generate a signed download URL for Design Automation input files
   *
   * @remarks
   * DA WorkItems use signed URLs to fetch input files. These URLs
   * are pre-authenticated and don't require bearer tokens.
   *
   * @param bucketKey - OSS bucket containing the file
   * @param fileName - Object key to generate URL for
   * @param expiryMinutes - URL validity period (default: 60 minutes)
   * @returns Pre-signed URL for downloading the file
   * @throws Error if URL generation fails
   */
  async generateSignedDownloadUrl(
    bucketKey: string,
    fileName: string,
    expiryMinutes: number = 60
  ): Promise<string> {
    const accessToken = await this.authService.getAccessToken()

    const response = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(fileName)}/signed`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ minutesExpiration: expiryMinutes }),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to generate signed URL: ${response.statusText}`)
    }

    const data = (await response.json()) as { signedUrl: string }
    return data.signedUrl
  }

  /**
   * Generate a signed URL for DA output files (supports both PUT and GET)
   *
   * @remarks
   * Uses 'readwrite' access so the same URL can be used by:
   * - DA WorkItem to PUT the generated file
   * - Our server to GET the file after completion
   *
   * This avoids needing separate upload/download URLs.
   *
   * @param bucketKey - OSS bucket for the output
   * @param fileName - Output object key (e.g., 'Tile Q321.dwg')
   * @param expiryMinutes - URL validity period (default: 60 minutes)
   * @returns Pre-signed URL with PUT and GET access
   * @throws Error if URL generation fails
   */
  async generateOutputUrl(
    bucketKey: string,
    fileName: string,
    expiryMinutes: number = 60
  ): Promise<string> {
    const accessToken = await this.authService.getAccessToken()

    const response = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(fileName)}/signed?access=readwrite`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ minutesExpiration: expiryMinutes }),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to generate output URL: ${response.statusText}`)
    }

    const data = (await response.json()) as { signedUrl: string }
    return data.signedUrl
  }

  /**
   * Delete a temporary bucket and all its contents
   *
   * @remarks
   * **Currently unused** - transient buckets auto-delete after 24h.
   * Kept for explicit cleanup if needed (e.g., error recovery).
   * Non-throwing: errors are silently ignored to not block callers.
   *
   * @param bucketName - Bucket to delete
   */
  async deleteTempBucket(bucketName: string): Promise<void> {
    try {
      const accessToken = await this.authService.getAccessToken()

      // List and delete objects first
      try {
        const objects: any = await this.objectsApi.getObjects(accessToken, bucketName)
        const items = objects.items || objects.content?.items
        if (items && items.length > 0) {
          for (const obj of items) {
            await this.objectsApi.deleteObject(accessToken, bucketName, obj.objectKey)
          }
        }
      } catch {
        // Ignore errors listing/deleting objects
      }

      // Delete bucket
      await this.bucketsApi.deleteBucket(accessToken, bucketName)
    } catch {
      // Non-blocking cleanup - don't throw
    }
  }

  /**
   * Create a base64-encoded URN from bucket and object key
   *
   * @remarks
   * URN format: `urn:adsk.objects:os.object:{bucketKey}/{objectKey}`
   * Then base64-encoded without padding (trailing '=' removed).
   * This URN is used for Model Derivative API (translation, viewer).
   *
   * @param bucketKey - OSS bucket key
   * @param objectKey - Object key within the bucket
   * @returns Base64-encoded URN (no padding)
   */
  createUrn(bucketKey: string, objectKey: string): string {
    const objectId = `urn:adsk.objects:os.object:${bucketKey}/${objectKey}`
    return Buffer.from(objectId).toString('base64').replace(/=/g, '')
  }

  /**
   * Start SVF2 translation for Autodesk Viewer
   *
   * @remarks
   * Triggers async translation via Model Derivative API.
   * - Uses EMEA endpoint to match bucket region
   * - `x-ads-force: true` forces re-translation if already exists
   * - 409 status (already translating) is silently ignored
   *
   * Translation runs in background. Viewer polls manifest for status.
   * Typical DWG translation: 20-60 seconds.
   *
   * @param urn - Base64-encoded URN of the source file
   * @see {@link https://aps.autodesk.com/en/docs/model-derivative/v2/tutorials/translate-dwg/} Translation Docs
   */
  async startSvfTranslation(urn: string): Promise<void> {
    const accessToken = await this.authService.getAccessToken()

    const response = await fetch(
      'https://developer.api.autodesk.com/modelderivative/v2/regions/eu/designdata/job',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-force': 'true', // Force re-translation if exists
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
      // 409 = already translating, that's fine
      const errorText = await response.text()
      console.warn(`SVF translation warning: ${response.status} - ${errorText}`)
    }
  }

  /**
   * Start SVF2 translation for a ZIP bundle containing DWG + images
   *
   * @remarks
   * Used when the DWG has embedded image references that must be included.
   * The ZIP contains:
   * - DWG file (specified by rootFilename)
   * - PNG/JPG images referenced in the DWG
   *
   * The `compressedUrn: true` flag tells Model Derivative to extract the ZIP
   * and use rootFilename as the main file to translate.
   *
   * @param urn - Base64-encoded URN of the ZIP file
   * @param rootFilename - Name of the DWG file inside the ZIP (e.g., 'Tile.dwg')
   */
  async startSvfTranslationWithRoot(urn: string, rootFilename: string): Promise<void> {
    const accessToken = await this.authService.getAccessToken()

    const response = await fetch(
      'https://developer.api.autodesk.com/modelderivative/v2/regions/eu/designdata/job',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-force': 'true', // Force re-translation if exists
        },
        body: JSON.stringify({
          input: {
            urn,
            compressedUrn: true,
            rootFilename
          },
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
      // 409 = already translating, that's fine
      const errorText = await response.text()
      console.warn(`SVF translation warning: ${response.status} - ${errorText}`)
    }
  }
}
