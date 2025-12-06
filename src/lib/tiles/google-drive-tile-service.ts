/**
 * Google Drive Service for Tiles
 *
 * Handles uploading generated tiles (DWG and images) to Google Shared Drive
 * Path: HUB/RESOURCES/TILES/{tileName}/
 *
 * Uses Service Account authentication
 */

import { google, drive_v3 } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

// Get environment variable
function getEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export interface UploadedFile {
  id: string
  name: string
  webViewLink: string
}

export interface TileUploadResult {
  success: boolean
  tileFolderId: string
  tileFolderLink: string
  files: UploadedFile[]
  errors: string[]
}

class GoogleDriveTileService {
  private drive: drive_v3.Drive
  private hubDriveId: string

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
      scopes: ['https://www.googleapis.com/auth/drive'],
    })

    this.drive = google.drive({ version: 'v3', auth })
  }

  /**
   * Find or create the TILES folder path: HUB/RESOURCES/TILES
   * Always queries Drive to ensure we have the current folder ID
   */
  async ensureTilesFolder(): Promise<string> {
    // Find RESOURCES folder in HUB root
    const resourcesFolder = await this.findFolder('RESOURCES', this.hubDriveId)
    if (!resourcesFolder) {
      throw new Error('RESOURCES folder not found in HUB Shared Drive')
    }

    // Find or create TILES folder inside RESOURCES
    let tilesFolder = await this.findFolder('TILES', resourcesFolder.id!)
    if (!tilesFolder) {
      console.log('Creating TILES folder in RESOURCES...')
      tilesFolder = await this.createFolder('TILES', resourcesFolder.id!)
    }

    return tilesFolder.id!
  }

  /**
   * Upload tile files (DWG, images, and optional report) to Google Drive
   * Creates folder: TILES/{tileName}/
   */
  async uploadTileFiles(
    tileName: string,
    dwgBuffer: Buffer,
    images: Array<{ name: string; buffer: Buffer }>,
    report?: string
  ): Promise<TileUploadResult> {
    const errors: string[] = []
    const uploadedFiles: UploadedFile[] = []

    try {
      // Ensure TILES folder exists
      const tilesFolderId = await this.ensureTilesFolder()

      // Check if tile folder already exists - rename to .BAK if so
      const existingFolder = await this.findFolder(tileName, tilesFolderId)
      if (existingFolder) {
        const bakName = `${tileName}.BAK`
        // Delete any existing .BAK folder first (ignore errors if already deleted)
        try {
          const existingBak = await this.findFolder(bakName, tilesFolderId)
          if (existingBak) {
            await this.deleteFolder(existingBak.id!)
            console.log(`Deleted old backup: ${bakName}`)
          }
        } catch (err) {
          console.log(`Could not delete old backup (may not exist): ${bakName}`)
        }
        // Rename existing folder to .BAK (ignore errors if folder no longer exists)
        try {
          await this.renameFolder(existingFolder.id!, bakName)
          console.log(`Renamed existing folder to: ${bakName}`)
        } catch (err) {
          console.log(`Could not rename existing folder (may not exist): ${tileName}`)
        }
      }

      // Create new tile folder
      const tileFolder = await this.createFolder(tileName, tilesFolderId)
      console.log(`Created tile folder: ${tileName}`)

      const tileFolderId = tileFolder.id!
      const tileFolderLink = `https://drive.google.com/drive/folders/${tileFolderId}`

      // Prepare all upload tasks for parallel execution
      const uploadTasks: Array<{
        name: string
        buffer: Buffer
        mimeType: string
        type: 'dwg' | 'image' | 'report'
      }> = []

      // Add DWG
      uploadTasks.push({
        name: `${tileName}.dwg`,
        buffer: dwgBuffer,
        mimeType: 'application/acad',
        type: 'dwg'
      })

      // Add images
      for (const img of images) {
        uploadTasks.push({
          name: img.name,
          buffer: img.buffer,
          mimeType: 'image/png',
          type: 'image'
        })
      }

      // Add report if provided
      if (report) {
        uploadTasks.push({
          name: `${tileName}-report.txt`,
          buffer: Buffer.from(report, 'utf-8'),
          mimeType: 'text/plain',
          type: 'report'
        })
      }

      // Upload all files in parallel
      console.log(`Uploading ${uploadTasks.length} files in parallel...`)
      const uploadResults = await Promise.allSettled(
        uploadTasks.map(async (task) => {
          const file = await this.uploadFile(task.name, task.buffer, task.mimeType, tileFolderId)
          return { ...task, file }
        })
      )

      // Process results
      for (const result of uploadResults) {
        if (result.status === 'fulfilled') {
          const { name, type, file } = result.value
          uploadedFiles.push({
            id: file.id!,
            name: file.name!,
            webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`
          })
          console.log(`Uploaded ${type}: ${name}`)
        } else {
          const msg = `Upload failed: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`
          errors.push(msg)
          console.error(msg)
        }
      }

      return {
        success: errors.length === 0,
        tileFolderId,
        tileFolderLink,
        files: uploadedFiles,
        errors
      }
    } catch (err) {
      return {
        success: false,
        tileFolderId: '',
        tileFolderLink: '',
        files: uploadedFiles,
        errors: [err instanceof Error ? err.message : 'Unknown error']
      }
    }
  }

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
   * Rename a folder in Google Drive
   */
  private async renameFolder(folderId: string, newName: string): Promise<void> {
    await this.drive.files.update({
      fileId: folderId,
      requestBody: { name: newName },
      supportsAllDrives: true,
    })
  }

  /**
   * Delete a folder in Google Drive (moves to trash)
   */
  private async deleteFolder(folderId: string): Promise<void> {
    await this.drive.files.delete({
      fileId: folderId,
      supportsAllDrives: true,
    })
  }

  /**
   * Upload a file to Google Drive
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

  /**
   * Download a file from Google Drive by its ID
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    const response = await this.drive.files.get({
      fileId,
      alt: 'media',
      supportsAllDrives: true,
    }, {
      responseType: 'arraybuffer'
    })

    return Buffer.from(response.data as ArrayBuffer)
  }

  /**
   * Get file metadata including parent folder
   */
  async getFileInfo(fileId: string): Promise<{ name: string; parentId: string } | null> {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'name, parents',
        supportsAllDrives: true,
      })

      const parents = response.data.parents
      if (!parents || parents.length === 0) {
        return null
      }

      return {
        name: response.data.name || '',
        parentId: parents[0]
      }
    } catch {
      return null
    }
  }

  /**
   * List all files in a folder
   */
  async listFilesInFolder(folderId: string): Promise<Array<{ id: string; name: string; mimeType: string }>> {
    const response = await this.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      driveId: this.hubDriveId,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'drive',
      fields: 'files(id, name, mimeType)',
    })

    return (response.data.files || []).map(f => ({
      id: f.id || '',
      name: f.name || '',
      mimeType: f.mimeType || ''
    }))
  }

  /**
   * Download all tile files (DWG + images) from a folder
   * Returns the DWG and all PNG images
   */
  async downloadTileFiles(dwgFileId: string): Promise<{
    dwg: { name: string; buffer: Buffer };
    images: Array<{ name: string; buffer: Buffer }>;
  }> {
    // Get the parent folder from the DWG file
    const fileInfo = await this.getFileInfo(dwgFileId)
    if (!fileInfo) {
      throw new Error('Could not get DWG file info')
    }

    // List all files in the folder
    const files = await this.listFilesInFolder(fileInfo.parentId)

    // Download DWG
    const dwgBuffer = await this.downloadFile(dwgFileId)

    // Download all PNG images
    const images: Array<{ name: string; buffer: Buffer }> = []
    for (const file of files) {
      if (file.name.endsWith('.png') || file.name.endsWith('.PNG')) {
        const buffer = await this.downloadFile(file.id)
        images.push({ name: file.name, buffer })
      }
    }

    return {
      dwg: { name: fileInfo.name, buffer: dwgBuffer },
      images
    }
  }
}

// Version to invalidate cached instances when code changes
const SERVICE_VERSION = 6

// Use globalThis to ensure singleton across all API routes in Next.js
const globalForDrive = globalThis as unknown as {
  googleDriveTileService: GoogleDriveTileService | undefined
  googleDriveTileServiceVersion: number | undefined
}

export function getGoogleDriveTileService(): GoogleDriveTileService {
  // Recreate service if version changed (code was updated)
  if (globalForDrive.googleDriveTileServiceVersion !== SERVICE_VERSION) {
    globalForDrive.googleDriveTileService = undefined
    globalForDrive.googleDriveTileServiceVersion = SERVICE_VERSION
  }

  if (!globalForDrive.googleDriveTileService) {
    globalForDrive.googleDriveTileService = new GoogleDriveTileService()
  }
  return globalForDrive.googleDriveTileService
}

export { GoogleDriveTileService }
