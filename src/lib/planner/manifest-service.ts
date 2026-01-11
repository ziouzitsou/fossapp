/**
 * APS Manifest Service
 *
 * Handles Model Derivative manifest parsing and thumbnail fetching:
 * - Parse translation manifests for UI display
 * - Extract document info, warnings, and view data
 * - Fetch thumbnail images as base64
 *
 * @module planner/manifest-service
 */

import { getAccessToken } from './auth'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parsed manifest data for UI display
 */
export interface ManifestData {
  status: 'pending' | 'inprogress' | 'success' | 'failed'
  hasThumbnail: boolean
  thumbnailUrn?: string
  warningCount: number
  warnings: Array<{
    code: string
    message: string
  }>
  documentInfo?: {
    dwgVersion?: string
    author?: string
    fileSize?: string
    dateCreated?: string
    lastWrite?: string
  }
  views: Array<{
    guid: string
    name: string
    role: string
    thumbnailUrn?: string
  }>
}

// ============================================================================
// MANIFEST OPERATIONS
// ============================================================================

/**
 * Get and parse the full manifest for a URN
 * Returns structured data for UI display
 *
 * @param urn - Base64-encoded URN
 * @returns Parsed manifest data
 */
export async function getManifestData(urn: string): Promise<ManifestData> {
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
        return {
          status: 'pending',
          hasThumbnail: false,
          warningCount: 0,
          warnings: [],
          views: []
        }
      }
      throw new Error(`Failed to get manifest: ${response.status}`)
    }

    const manifest = await response.json()
    return parseManifest(manifest)
  } catch (err) {
    console.error('[Planner] Error fetching manifest:', err)
    return {
      status: 'pending',
      hasThumbnail: false,
      warningCount: 0,
      warnings: [],
      views: []
    }
  }
}

/**
 * Parse raw APS manifest into structured data
 *
 * @param manifest - Raw manifest from APS API
 * @returns Parsed ManifestData
 */
function parseManifest(manifest: Record<string, unknown>): ManifestData {
  const result: ManifestData = {
    status: (manifest.status as string || 'pending') as ManifestData['status'],
    hasThumbnail: manifest.hasThumbnail === 'true',
    warningCount: 0,
    warnings: [],
    views: []
  }

  const derivatives = manifest.derivatives as Array<Record<string, unknown>> | undefined
  if (!derivatives || derivatives.length === 0) {
    return result
  }

  const mainDerivative = derivatives[0]

  // Extract warnings
  const messages = mainDerivative.messages as Array<{
    type?: string
    code?: string
    message?: string | string[]
  }> | undefined

  if (messages) {
    for (const msg of messages) {
      if (msg.type === 'warning' && msg.code) {
        const messageText = Array.isArray(msg.message)
          ? msg.message.join(' - ')
          : (msg.message || '')
        result.warnings.push({
          code: msg.code,
          message: messageText
        })
      }
    }
    result.warningCount = result.warnings.length
  }

  // Extract document info
  const properties = mainDerivative.properties as Record<string, Record<string, string>> | undefined
  if (properties?.['Document Information']) {
    const docInfo = properties['Document Information']
    result.documentInfo = {
      dwgVersion: docInfo['DWGVersion'],
      author: docInfo['Last Author'],
      fileSize: docInfo['FileSize'],
      dateCreated: docInfo['Date Created'],
      lastWrite: docInfo['Last Write']
    }
  }

  // Extract views and thumbnails
  const children = mainDerivative.children as Array<Record<string, unknown>> | undefined
  if (children) {
    for (const child of children) {
      if (child.type === 'geometry' && child.role === '2d') {
        const view: ManifestData['views'][0] = {
          guid: child.guid as string,
          name: child.name as string || 'Unknown',
          role: child.role as string
        }

        // Find 200x200 thumbnail
        const viewChildren = child.children as Array<Record<string, unknown>> | undefined
        if (viewChildren) {
          for (const resource of viewChildren) {
            if (resource.role === 'thumbnail') {
              const resolution = resource.resolution as number[] | undefined
              if (resolution && resolution[0] === 200) {
                view.thumbnailUrn = resource.urn as string
                if (!result.thumbnailUrn) {
                  result.thumbnailUrn = resource.urn as string
                }
              }
            }
          }
        }

        result.views.push(view)
      }
    }
  }

  return result
}

// ============================================================================
// THUMBNAIL OPERATIONS
// ============================================================================

/**
 * Fetch thumbnail image from APS
 * Returns base64 encoded PNG data
 *
 * @param thumbnailUrn - URN of the thumbnail resource
 * @returns Base64 data URL or null on error
 */
export async function getThumbnailBase64(thumbnailUrn: string): Promise<string | null> {
  const accessToken = await getAccessToken()

  try {
    const response = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/regions/eu/designdata/${encodeURIComponent(thumbnailUrn)}/thumbnail?width=200&height=200`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      console.error(`[Planner] Thumbnail fetch failed: ${response.status}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return `data:image/png;base64,${base64}`
  } catch (err) {
    console.error('[Planner] Error fetching thumbnail:', err)
    return null
  }
}
