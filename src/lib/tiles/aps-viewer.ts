/**
 * APS Viewer Service for Tiles
 *
 * Handles DWG viewing via Model Derivative API:
 * - Upload DWG to transient bucket (24-hour retention)
 * - Translate to SVF2 for web viewing
 * - Provide viewer-only access tokens
 *
 * Separate from aps-service.ts which handles Design Automation.
 */

import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager'
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication'
import { OssClient, Region, PolicyKey } from '@aps_sdk/oss'
import { ModelDerivativeClient, View } from '@aps_sdk/model-derivative'

// Configuration
const APS_CLIENT_ID = process.env.APS_CLIENT_ID!
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET!
const VIEWER_BUCKET = 'fossapp-tile-viewer' // Transient bucket for viewer files

// SDK Manager singleton
const sdkManager = SdkManagerBuilder.create().build()

// Client singletons
const authClient = new AuthenticationClient({ sdkManager })
const ossClient = new OssClient({ sdkManager })
const modelDerivativeClient = new ModelDerivativeClient({ sdkManager })

// Token caches
let fullTokenCache: { accessToken: string; expiresAt: number } | null = null
let viewerTokenCache: { accessToken: string; expiresAt: number } | null = null

/**
 * Get full access token (server-to-server)
 * Cached until 5 minutes before expiration
 */
export async function getAccessToken(): Promise<{ access_token: string; expires_in: number }> {
  // Return cached token if still valid
  if (fullTokenCache && fullTokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return {
      access_token: fullTokenCache.accessToken,
      expires_in: Math.floor((fullTokenCache.expiresAt - Date.now()) / 1000)
    }
  }

  const credentials = await authClient.getTwoLeggedToken(
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    [Scopes.DataRead, Scopes.DataWrite, Scopes.DataCreate, Scopes.BucketCreate, Scopes.BucketRead, Scopes.ViewablesRead]
  )

  fullTokenCache = {
    accessToken: credentials.access_token,
    expiresAt: Date.now() + (credentials.expires_in * 1000)
  }

  return {
    access_token: credentials.access_token,
    expires_in: credentials.expires_in
  }
}

/**
 * Get viewer-only token (read-only scopes for client-side viewer)
 */
export async function getViewerToken(): Promise<{ access_token: string; expires_in: number }> {
  // Return cached token if still valid
  if (viewerTokenCache && viewerTokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return {
      access_token: viewerTokenCache.accessToken,
      expires_in: Math.floor((viewerTokenCache.expiresAt - Date.now()) / 1000)
    }
  }

  const credentials = await authClient.getTwoLeggedToken(
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    [Scopes.DataRead, Scopes.ViewablesRead]
  )

  viewerTokenCache = {
    accessToken: credentials.access_token,
    expiresAt: Date.now() + (credentials.expires_in * 1000)
  }

  return {
    access_token: credentials.access_token,
    expires_in: credentials.expires_in
  }
}

/**
 * Ensure transient viewer bucket exists
 */
export async function ensureViewerBucketExists(): Promise<void> {
  const { access_token } = await getAccessToken()

  try {
    await ossClient.getBucketDetails(VIEWER_BUCKET, { accessToken: access_token })
  } catch (err: unknown) {
    const error = err as { axiosError?: { response?: { status?: number } } }
    if (error.axiosError?.response?.status === 404) {
      // Create transient bucket (24-hour retention)
      await ossClient.createBucket(
        Region.Emea, // Same region as our other APS resources
        { bucketKey: VIEWER_BUCKET, policyKey: PolicyKey.Transient },
        { accessToken: access_token }
      )
      console.log(`Created transient viewer bucket: ${VIEWER_BUCKET}`)
    } else {
      throw err
    }
  }
}

/**
 * Upload DWG buffer to viewer bucket
 */
export async function uploadForViewing(
  fileName: string,
  fileBuffer: Buffer
): Promise<{ objectId: string; urn: string }> {
  await ensureViewerBucketExists()
  const { access_token } = await getAccessToken()

  // Add timestamp to prevent collisions
  const uniqueName = `${Date.now()}-${fileName}`

  const result = await ossClient.uploadObject(
    VIEWER_BUCKET,
    uniqueName,
    fileBuffer,
    { accessToken: access_token }
  )

  if (!result.objectId) {
    throw new Error('Upload failed: no objectId returned')
  }

  // Create base64-encoded URN (without padding)
  const urn = Buffer.from(result.objectId).toString('base64').replace(/=/g, '')

  return {
    objectId: result.objectId,
    urn
  }
}

/**
 * Start model translation to SVF2
 * @param urn - Base64-encoded object ID
 * @param rootFilename - For ZIP files, specifies the root design file inside the archive
 */
export async function translateToSVF2(urn: string, rootFilename?: string): Promise<{ urn: string; status: string }> {
  const { access_token } = await getAccessToken()

  const jobPayload = {
    input: {
      urn,
      ...(rootFilename && { compressedUrn: true, rootFilename })
    },
    output: {
      formats: [{
        type: 'svf2' as const,
        views: [View._2d, View._3d]
      }]
    }
  }

  const result = await modelDerivativeClient.startJob(
    jobPayload,
    { accessToken: access_token }
  )

  return {
    urn,
    status: result.result || 'created'
  }
}

/**
 * Get translation status
 */
export async function getTranslationStatus(urn: string): Promise<{
  status: string
  progress: string
  messages?: string[]
}> {
  const { access_token } = await getAccessToken()

  try {
    const manifest = await modelDerivativeClient.getManifest(urn, { accessToken: access_token })

    const messages: string[] = []
    if (manifest.derivatives) {
      for (const derivative of manifest.derivatives) {
        if (derivative.messages) {
          for (const msg of derivative.messages) {
            if (typeof msg === 'object' && msg !== null && 'message' in msg) {
              messages.push((msg as { message: string }).message)
            }
          }
        }
      }
    }

    return {
      status: manifest.status,
      progress: manifest.progress || '0%',
      messages: messages.length > 0 ? messages : undefined
    }
  } catch (err: unknown) {
    const error = err as { axiosError?: { response?: { status?: number } } }
    if (error.axiosError?.response?.status === 404) {
      return {
        status: 'pending',
        progress: '0%'
      }
    }
    throw err
  }
}

/**
 * Upload and translate DWG for viewing
 * Returns URN and expiration time (24 hours from now)
 *
 * If images are provided, creates a ZIP bundle so the DWG can reference them.
 */
export async function prepareForViewing(
  fileName: string,
  fileBuffer: Buffer,
  images?: Array<{ name: string; buffer: Buffer }>
): Promise<{ urn: string; expiresAt: number }> {
  let uploadBuffer: Buffer
  let uploadName: string
  let rootFilename: string | undefined

  if (images && images.length > 0) {
    // Create ZIP bundle with DWG and images
    const { default: archiver } = await import('archiver')
    const { Writable } = await import('stream')

    // Create a buffer to collect the ZIP data
    const chunks: Buffer[] = []
    const writable = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk)
        callback()
      }
    })

    const archive = archiver('zip', { zlib: { level: 5 } })

    await new Promise<void>((resolve, reject) => {
      writable.on('finish', resolve)
      writable.on('error', reject)
      archive.on('error', reject)

      archive.pipe(writable)

      // Add DWG file
      archive.append(fileBuffer, { name: fileName })

      // Add images
      for (const img of images) {
        archive.append(img.buffer, { name: img.name })
      }

      archive.finalize()
    })

    uploadBuffer = Buffer.concat(chunks)
    uploadName = fileName.replace(/\.dwg$/i, '.zip')
    rootFilename = fileName

    console.log(`Created ZIP bundle: ${uploadName} (${(uploadBuffer.length / 1024).toFixed(0)} KB) with ${images.length} images`)
  } else {
    // Just the DWG file
    uploadBuffer = fileBuffer
    uploadName = fileName
  }

  // Upload to transient bucket
  const { urn } = await uploadForViewing(uploadName, uploadBuffer)

  // Start translation (with rootFilename for ZIP)
  await translateToSVF2(urn, rootFilename)

  // Transient bucket = 24-hour retention
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000

  return { urn, expiresAt }
}
