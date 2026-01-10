/**
 * Google Drive Service for Product Symbols
 *
 * Handles syncing symbol DWG files to Google Shared Drive for XREF resolution.
 * Path: HUB/RESOURCES/SYMBOLS/{foss_pid}/{foss_pid}-SYMBOL.dwg
 *
 * @remarks
 * Symbols are stored in Supabase as the source of truth, but also synced to
 * Google Drive so that XREFs in generated DWGs resolve when users open them
 * locally (all users have Google Drive synced).
 *
 * Uses Service Account authentication (same as tiles service).
 */

import { google, drive_v3 } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Get environment variable value
 */
function getEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Result of uploading a symbol to Google Drive
 */
export interface SymbolUploadResult {
  success: boolean
  folderId?: string
  folderLink?: string
  fileId?: string
  error?: string
}

/**
 * Result of deleting a symbol from Google Drive
 */
export interface SymbolDeleteResult {
  success: boolean
  error?: string
}

class GoogleDriveSymbolService {
  private drive: drive_v3.Drive
  private hubDriveId: string

  constructor() {
    this.hubDriveId = getEnvVar('GOOGLE_DRIVE_HUB_ID')

    // Load service account credentials
    const credentialsPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH ||
      path.join(process.cwd(), 'credentials', 'google-service-account.json')

    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`Service account credentials not found at: ${credentialsPath}`)
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'))

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    })

    this.drive = google.drive({ version: 'v3', auth })
  }

  /**
   * Find or create the SYMBOLS folder path: HUB/RESOURCES/SYMBOLS
   */
  async ensureSymbolsFolder(): Promise<string> {
    // Find RESOURCES folder in HUB root
    const resourcesFolder = await this.findFolder('RESOURCES', this.hubDriveId)
    if (!resourcesFolder) {
      throw new Error('RESOURCES folder not found in HUB Shared Drive')
    }

    // Find or create SYMBOLS folder inside RESOURCES
    let symbolsFolder = await this.findFolder('SYMBOLS', resourcesFolder.id!)
    if (!symbolsFolder) {
      symbolsFolder = await this.createFolder('SYMBOLS', resourcesFolder.id!)
    }

    return symbolsFolder.id!
  }

  /**
   * Upload a symbol DWG file to Google Drive
   * Creates: SYMBOLS/{foss_pid}/{foss_pid}-SYMBOL.dwg
   *
   * @param fossPid - Product ID (e.g., "DT107479228WW")
   * @param dwgBuffer - DWG file content
   * @returns Upload result with folder and file IDs
   */
  async uploadSymbol(fossPid: string, dwgBuffer: Buffer): Promise<SymbolUploadResult> {
    try {
      // Ensure SYMBOLS folder exists
      const symbolsFolderId = await this.ensureSymbolsFolder()

      // Find or create product folder (e.g., "DT107479228WW")
      let productFolder = await this.findFolder(fossPid, symbolsFolderId)
      if (!productFolder) {
        productFolder = await this.createFolder(fossPid, symbolsFolderId)
      }

      const productFolderId = productFolder.id!
      const folderLink = `https://drive.google.com/drive/folders/${productFolderId}`

      // Upload DWG file (upsert - replace if exists)
      const fileName = `${fossPid}-SYMBOL.dwg`
      const file = await this.uploadFile(fileName, dwgBuffer, 'application/acad', productFolderId)

      return {
        success: true,
        folderId: productFolderId,
        folderLink,
        fileId: file.id!,
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[GoogleDriveSymbolService] Upload failed for ${fossPid}:`, error)
      return { success: false, error }
    }
  }

  /**
   * Delete a symbol folder from Google Drive
   * Removes: SYMBOLS/{foss_pid}/ (entire folder)
   *
   * @param fossPid - Product ID
   * @returns Delete result
   */
  async deleteSymbol(fossPid: string): Promise<SymbolDeleteResult> {
    try {
      // Find SYMBOLS folder
      const symbolsFolderId = await this.ensureSymbolsFolder()

      // Find product folder
      const productFolder = await this.findFolder(fossPid, symbolsFolderId)
      if (!productFolder) {
        // Already deleted - consider success
        return { success: true }
      }

      // Delete the entire folder
      await this.drive.files.delete({
        fileId: productFolder.id!,
        supportsAllDrives: true,
      })

      return { success: true }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[GoogleDriveSymbolService] Delete failed for ${fossPid}:`, error)
      return { success: false, error }
    }
  }

  /**
   * Get the local Windows path for a symbol
   * Used for XREF path generation
   *
   * @param fossPid - Product ID
   * @returns Windows path (e.g., "F:\\Shared drives\\HUB\\RESOURCES\\SYMBOLS\\DT123\\DT123-SYMBOL.dwg")
   */
  getSymbolLocalPath(fossPid: string): string {
    const hubPath = process.env.GOOGLE_DRIVE_HUB_PATH || 'F:\\Shared drives\\HUB'
    // Use forward slashes for AutoCAD compatibility
    return `${hubPath}/RESOURCES/SYMBOLS/${fossPid}/${fossPid}-SYMBOL.dwg`.replace(/\\/g, '/')
  }

  // ─────────────────────────────────────────────────────────────
  // Private helper methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Find a folder by name in a parent folder
   */
  private async findFolder(name: string, parentId: string): Promise<drive_v3.Schema$File | null> {
    const response = await this.drive.files.list({
      q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
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
   * Create a folder in Google Drive
   */
  private async createFolder(name: string, parentId: string): Promise<drive_v3.Schema$File> {
    const response = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      supportsAllDrives: true,
      fields: 'id, name',
    })

    return response.data
  }

  /**
   * Upload a file to Google Drive (upsert - replace if exists)
   */
  private async uploadFile(
    name: string,
    buffer: Buffer,
    mimeType: string,
    parentId: string
  ): Promise<drive_v3.Schema$File> {
    const { Readable } = await import('stream')
    const stream = Readable.from(buffer)

    // Check if file already exists (to update instead of duplicate)
    const existing = await this.findFile(name, parentId)

    if (existing) {
      // Update existing file
      const response = await this.drive.files.update({
        fileId: existing.id!,
        media: {
          mimeType,
          body: stream,
        },
        supportsAllDrives: true,
        fields: 'id, name, webViewLink',
      })
      return response.data
    }

    // Create new file
    const response = await this.drive.files.create({
      requestBody: {
        name,
        parents: [parentId],
      },
      media: {
        mimeType,
        body: stream,
      },
      supportsAllDrives: true,
      fields: 'id, name, webViewLink',
    })

    return response.data
  }

  /**
   * Find a file by name in a folder
   */
  private async findFile(name: string, parentId: string): Promise<drive_v3.Schema$File | null> {
    const response = await this.drive.files.list({
      q: `name='${name}' and mimeType!='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      driveId: this.hubDriveId,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'drive',
      fields: 'files(id, name)',
    })

    const files = response.data.files || []
    return files.length > 0 ? files[0] : null
  }
}

// Singleton pattern with version invalidation
const SERVICE_VERSION = 1

const globalForDrive = globalThis as unknown as {
  googleDriveSymbolService: GoogleDriveSymbolService | undefined
  googleDriveSymbolServiceVersion: number | undefined
}

/**
 * Get the singleton GoogleDriveSymbolService instance
 */
export function getGoogleDriveSymbolService(): GoogleDriveSymbolService {
  // Recreate service if version changed (code was updated)
  if (globalForDrive.googleDriveSymbolServiceVersion !== SERVICE_VERSION) {
    globalForDrive.googleDriveSymbolService = undefined
    globalForDrive.googleDriveSymbolServiceVersion = SERVICE_VERSION
  }

  if (!globalForDrive.googleDriveSymbolService) {
    globalForDrive.googleDriveSymbolService = new GoogleDriveSymbolService()
  }
  return globalForDrive.googleDriveSymbolService
}

export { GoogleDriveSymbolService }
