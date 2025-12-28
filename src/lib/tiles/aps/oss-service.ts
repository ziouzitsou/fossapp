/**
 * APS Object Storage Service (OSS)
 * Handles bucket creation, file uploads, signed URLs, and SVF translation
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BucketsApi, ObjectsApi } from '@aps_sdk/oss'
import { APSAuthService } from './auth-service'
import type { FileUploadResult } from './types'

export class OSSService {
  private bucketsApi: BucketsApi
  private objectsApi: ObjectsApi
  private authService: APSAuthService

  constructor(authService: APSAuthService) {
    this.authService = authService
    const sdkManager = authService.getSdkManager()
    this.bucketsApi = new BucketsApi(sdkManager)
    this.objectsApi = new ObjectsApi(sdkManager)
  }

  /**
   * Generate unique bucket name
   */
  generateBucketName(): string {
    return `tile-processing-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
  }

  /**
   * Create temporary bucket for tile processing
   * Using REST API directly to avoid SDK region issues
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
   * Upload file buffer to OSS using Direct-to-S3
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
   * Generate signed download URL for Design Automation
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
   * Generate signed URL for output files (supports both PUT and GET)
   * Uses OSS signed URL with readwrite access so file is accessible after upload
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
   * Delete temporary bucket and all its contents
   * NOTE: Currently not used - transient buckets auto-delete after 24h
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
   * Create URN from bucket and object key
   */
  createUrn(bucketKey: string, objectKey: string): string {
    const objectId = `urn:adsk.objects:os.object:${bucketKey}/${objectKey}`
    return Buffer.from(objectId).toString('base64').replace(/=/g, '')
  }

  /**
   * Start SVF2 translation for viewer
   * Translation runs in background, viewer will poll for status
   * Uses EMEA endpoint since our buckets are in EMEA region
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
   * Start SVF2 translation for a ZIP bundle with rootFilename
   * Used when DWG has external references (images) bundled in a ZIP
   * Uses EMEA endpoint since our buckets are in EMEA region
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
