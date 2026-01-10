/**
 * Google Drive Template Service for Planner
 *
 * Fetches DWG templates from Google Shared Drive for Design Automation processing.
 * Path: HUB/RESOURCES/TEMPLATES/
 *
 * Features:
 * - In-memory caching with 1-hour TTL
 * - Service Account authentication (same as tiles)
 *
 * @module planner/google-drive-template-service
 */

import { google, drive_v3 } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

/** Template cache entry with buffer and fetch timestamp */
interface TemplateCacheEntry {
  buffer: Buffer
  fetchedAt: number
}

/** Cache TTL: 1 hour in milliseconds */
const CACHE_TTL_MS = 60 * 60 * 1000

/** Maximum retry attempts for Google Drive operations */
const MAX_RETRIES = 3

/** Base delay for exponential backoff (ms) */
const RETRY_BASE_DELAY_MS = 1000

/**
 * Execute an async operation with exponential backoff retry
 *
 * @param operation - Async function to execute
 * @param operationName - Name for logging
 * @param maxRetries - Maximum retry attempts
 * @returns Result of the operation
 * @throws Last error if all retries fail
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
        console.warn(
          `[Template] ${operationName} failed (attempt ${attempt}/${maxRetries}): ${lastError.message}. Retrying in ${delay}ms...`
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  console.error(`[Template] ${operationName} failed after ${maxRetries} attempts`)
  throw lastError
}

/**
 * Get required environment variable or throw
 */
function getEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Escape single quotes in Google Drive query strings
 *
 * Google Drive API query syntax uses single quotes for string values.
 * Names containing quotes must have them escaped with backslash.
 *
 * @param value - String value to escape
 * @returns Escaped string safe for Drive API queries
 */
function escapeQueryValue(value: string): string {
  return value.replace(/'/g, "\\'")
}

/**
 * Google Drive Template Service
 *
 * Provides access to DWG templates stored in Google Drive for use with
 * APS Design Automation. Templates are cached in memory to avoid
 * repeated downloads.
 */
class GoogleDriveTemplateService {
  private drive: drive_v3.Drive
  private hubDriveId: string
  private templateCache: Map<string, TemplateCacheEntry> = new Map()

  constructor() {
    this.hubDriveId = getEnvVar('GOOGLE_DRIVE_HUB_ID')

    // Load service account credentials
    const credentialsPath = path.join(process.cwd(), 'credentials', 'google-service-account.json')

    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`Service account credentials not found at: ${credentialsPath}`)
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'))

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    })

    this.drive = google.drive({ version: 'v3', auth })
  }

  /**
   * Fetch FOSS.dwt template from Google Drive
   *
   * Returns cached version if available and not expired (1 hour TTL).
   * Otherwise fetches from HUB/RESOURCES/TEMPLATES/FOSS.dwt
   *
   * @returns Template file buffer
   * @throws Error if template not found
   */
  async fetchFossTemplate(): Promise<Buffer> {
    return this.fetchTemplate('FOSS.dwt')
  }

  /**
   * Fetch any template by name from TEMPLATES folder
   *
   * Features:
   * - In-memory cache with 1-hour TTL
   * - Automatic retry with exponential backoff (3 attempts)
   * - Clear error messages for troubleshooting
   *
   * @param templateName - Name of template file (e.g., "FOSS.dwt")
   * @returns Template file buffer
   * @throws Error if template not found after all retries
   */
  async fetchTemplate(templateName: string): Promise<Buffer> {
    // Check cache first
    const cached = this.templateCache.get(templateName)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      console.log(`[Template] Using cached ${templateName} (age: ${Math.round((Date.now() - cached.fetchedAt) / 1000)}s)`)
      return cached.buffer
    }

    console.log(`[Template] Fetching ${templateName} from Google Drive (HUB/RESOURCES/TEMPLATES/)...`)

    // Wrap entire fetch operation with retry for network resilience
    const buffer = await withRetry(
      async () => {
        // Find RESOURCES folder in HUB root
        const resourcesFolder = await this.findFolder('RESOURCES', this.hubDriveId)
        if (!resourcesFolder) {
          throw new Error('RESOURCES folder not found in HUB Shared Drive. Check GOOGLE_DRIVE_HUB_ID env var.')
        }

        // Find TEMPLATES folder inside RESOURCES
        const templatesFolder = await this.findFolder('TEMPLATES', resourcesFolder.id!)
        if (!templatesFolder) {
          throw new Error('TEMPLATES folder not found in HUB/RESOURCES/. Create this folder in Google Drive.')
        }

        // Find the template file
        const templateFile = await this.findFile(templateName, templatesFolder.id!)
        if (!templateFile) {
          throw new Error(
            `Template "${templateName}" not found in HUB/RESOURCES/TEMPLATES/. ` +
            `Upload the template file to Google Drive.`
          )
        }

        // Download template
        return await this.downloadFile(templateFile.id!)
      },
      `Fetch ${templateName}`
    )

    // Cache the template
    this.templateCache.set(templateName, {
      buffer,
      fetchedAt: Date.now(),
    })

    console.log(`[Template] Fetched and cached ${templateName} (${buffer.length} bytes)`)
    return buffer
  }

  /**
   * Clear template cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.templateCache.clear()
    console.log('[Template] Cache cleared')
  }

  /**
   * Find a folder by name in a parent folder
   */
  private async findFolder(name: string, parentId: string): Promise<drive_v3.Schema$File | null> {
    const escapedName = escapeQueryValue(name)
    const response = await this.drive.files.list({
      q: `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      driveId: this.hubDriveId,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'drive',
      fields: 'files(id, name)',
    })

    const files = response.data.files || []
    return files.length > 0 ? files[0] : null
  }

  /**
   * Find a file by name in a folder
   */
  private async findFile(name: string, parentId: string): Promise<drive_v3.Schema$File | null> {
    const escapedName = escapeQueryValue(name)
    const response = await this.drive.files.list({
      q: `name='${escapedName}' and mimeType!='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      driveId: this.hubDriveId,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'drive',
      fields: 'files(id, name)',
    })

    const files = response.data.files || []
    return files.length > 0 ? files[0] : null
  }

  /**
   * Download a file from Google Drive by its ID
   */
  private async downloadFile(fileId: string): Promise<Buffer> {
    const response = await this.drive.files.get(
      {
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      {
        responseType: 'arraybuffer',
      }
    )

    return Buffer.from(response.data as ArrayBuffer)
  }
}

// Version to invalidate cached instances when code changes
const SERVICE_VERSION = 1

// Use globalThis to ensure singleton across all API routes in Next.js
const globalForTemplate = globalThis as unknown as {
  googleDriveTemplateService: GoogleDriveTemplateService | undefined
  googleDriveTemplateServiceVersion: number | undefined
}

/**
 * Get singleton instance of GoogleDriveTemplateService
 *
 * @returns Singleton template service instance
 */
export function getGoogleDriveTemplateService(): GoogleDriveTemplateService {
  // Recreate service if version changed (code was updated)
  if (globalForTemplate.googleDriveTemplateServiceVersion !== SERVICE_VERSION) {
    globalForTemplate.googleDriveTemplateService = undefined
    globalForTemplate.googleDriveTemplateServiceVersion = SERVICE_VERSION
  }

  if (!globalForTemplate.googleDriveTemplateService) {
    globalForTemplate.googleDriveTemplateService = new GoogleDriveTemplateService()
  }
  return globalForTemplate.googleDriveTemplateService
}

export { GoogleDriveTemplateService }
