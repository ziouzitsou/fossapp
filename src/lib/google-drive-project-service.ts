/**
 * Google Drive Project Service
 *
 * Manages Google Drive folder operations for project management.
 * Creates and maintains a standardized folder structure for each project.
 *
 * @remarks
 * **Authentication**: Uses a Service Account (no user tokens required).
 * Credentials loaded from `credentials/google-service-account.json` or
 * path specified in `GOOGLE_SERVICE_ACCOUNT_PATH` env var.
 *
 * **Folder Structure** (per project):
 * ```
 * {project_code}/
 * ├── 00_Customer/           # Customer reference files
 * │   ├── Drawings/
 * │   ├── Photos/
 * │   └── Documents/
 * ├── 01_Working/            # Engineer work-in-progress
 * │   ├── CAD/
 * │   └── Calculations/
 * ├── 02_Areas/              # Per-area folders (created dynamically)
 * │   └── {area_code}/
 * │       └── RV{n}/         # Revisions (RV1, RV2, etc.)
 * ├── 03_Output/             # Final deliverables
 * │   ├── Drawings/
 * │   ├── Presentations/
 * │   └── Schedules/
 * └── 04_Specs/              # Product specifications
 *     ├── Cut_Sheets/
 *     └── Photometrics/
 * ```
 *
 * **Usage**: Accessed via singleton pattern with `getGoogleDriveProjectService()`.
 *
 * @module google-drive-project-service
 * @see {@link https://developers.google.com/drive/api/v3/reference} Drive API Docs
 */

import { google, drive_v3 } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

// Environment variables - loaded at runtime to support dotenv
function getEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

// Skeleton folder structure - hierarchical
// Top-level folders only - subfolders created via createNestedFolders()
const SKELETON_STRUCTURE: Record<string, string[]> = {
  '00_Customer': ['Drawings', 'Photos', 'Documents'],
  '01_Working': ['CAD', 'Calculations'],
  '02_Areas': [], // Empty initially - populated when areas are added
  '03_Output': ['Drawings', 'Presentations', 'Schedules'],
  '04_Specs': ['Cut_Sheets', 'Photometrics'],
}

// README content for each folder (reserved for future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const README_CONTENT: Record<string, string> = {
  '00_Customer': `# Customer Files

Reference materials provided by the customer (read-only):

- **Drawings/**: Architectural DWG/DXF files, floor plans
- **Photos/**: Site photos, existing installation images
- **Documents/**: Specifications, requirements, correspondence

---

*This folder is part of the FOSSAPP project template.*
`,
  '01_Working': `# Working Files

Engineer work-in-progress files:

- **CAD/**: Working AutoCAD/DWG files
- **Calculations/**: DIALux, AGi32, Relux calculations

---

*This folder is part of the FOSSAPP project template.*
`,
  '02_Areas': `# Project Areas

Organized by area code (e.g., GF-LOBBY, FF-OFFICE).

Area folders are created automatically when areas are added in FOSSAPP.
Each area folder may contain Working and Output subfolders.

---

*This folder is part of the FOSSAPP project template.*
`,
  '03_Output': `# Final Deliverables

Files ready for customer delivery:

- **Drawings/**: Final PDFs and DWG files
- **Presentations/**: Renders, presentation materials
- **Schedules/**: Lighting schedules, BOMs

---

*This folder is part of the FOSSAPP project template.*
`,
  '04_Specs': `# Product Specifications

Product documentation and photometric data:

- **Cut_Sheets/**: Product specification sheets
- **Photometrics/**: IES/LDT files

---

*This folder is part of the FOSSAPP project template.*
`,
}

/**
 * A file or folder in Google Drive
 */
export interface DriveFile {
  /** Google Drive file ID */
  id: string
  /** File or folder name */
  name: string
  /** MIME type (folder: 'application/vnd.google-apps.folder') */
  mimeType: string
  /** File size in bytes (undefined for folders) */
  size?: string
  /** Last modified timestamp (ISO 8601) */
  modifiedTime?: string
  /** URL to view/edit in browser */
  webViewLink?: string
  /** True if this is a folder */
  isFolder: boolean
}

/**
 * Result of creating a project folder structure
 */
export interface ProjectFolderResult {
  /** ID of the main project folder */
  projectFolderId: string
  /** ID of 02_Areas folder for creating area subfolders */
  areasFolderId: string
}

/**
 * Result of creating an area folder
 */
export interface AreaFolderResult {
  /** ID of the area folder (e.g., "A01") */
  areaFolderId: string
  /** Area code used as folder name */
  areaCode: string
  /** ID of the initial RV1 revision folder inside the area */
  versionFolderId: string
}

/**
 * Result of creating a new area revision folder
 */
export interface AreaVersionFolderResult {
  /** ID of the revision folder (e.g., "RV2") */
  versionFolderId: string
  /** Revision number (1, 2, 3, etc.) */
  versionNumber: number
}

/**
 * @deprecated Project-level versioning removed. Use area-level revisions.
 */
export interface VersionFolderResult {
  versionFolderId: string
  versionNumber: number
}

/**
 * Service for managing Google Drive project folders
 *
 * @remarks
 * Use the singleton accessor `getGoogleDriveProjectService()` instead
 * of instantiating directly.
 */
class GoogleDriveProjectService {
  private drive: drive_v3.Drive
  /** HUB Shared Drive ID (from GOOGLE_DRIVE_HUB_ID env var) */
  private hubDriveId: string
  /** Projects folder ID within HUB (from GOOGLE_DRIVE_PROJECTS_FOLDER_ID env var) */
  private projectsFolderId: string

  /**
   * Create a new service instance
   *
   * @throws Error if env vars or credentials file are missing
   */
  constructor() {
    // Load environment variables
    this.hubDriveId = getEnvVar('GOOGLE_DRIVE_HUB_ID')
    this.projectsFolderId = getEnvVar('GOOGLE_DRIVE_PROJECTS_FOLDER_ID')

    // Load service account credentials
    // Priority: GOOGLE_SERVICE_ACCOUNT_PATH env var > default path
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
   * Execute an async function with exponential backoff retry
   * Retries on rate limit (403/429) and server errors (5xx)
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    operation = 'Drive API call'
  ): Promise<T> {
    let lastError: unknown

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error: unknown) {
        lastError = error
        const err = error as { code?: number; message?: string }

        // Retry on rate limit (403/429) or server errors (5xx)
        const isRetryable = err.code === 403 || err.code === 429 ||
          (err.code && err.code >= 500 && err.code < 600)

        if (isRetryable && attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000)
          console.warn(
            `${operation} failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms:`,
            err.message
          )
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          continue
        }

        // Don't retry on other errors or max retries reached
        throw error
      }
    }

    throw lastError
  }

  /**
   * Create a new project folder structure in Google Drive
   * Creates: Projects/{projectCode}/{skeleton folders with subfolders}
   *
   * @param projectCode - Project code (e.g., "2512-001")
   * @returns Project folder ID and areas folder ID
   */
  async createProjectFolder(projectCode: string): Promise<ProjectFolderResult> {
    // 1. Create project root folder
    const projectFolder = await this.createFolder(projectCode, this.projectsFolderId)

    // 2. Create skeleton structure with subfolders
    const folderIds = await this.createSkeletonStructure(projectFolder.id!)

    return {
      projectFolderId: projectFolder.id!,
      areasFolderId: folderIds['02_Areas'] || '',
    }
  }

  /**
   * Create an area folder inside the 02_Areas folder
   * Structure: 02_Areas/{areaCode}/v1/[Working, Output]
   *
   * @param areasFolderId - The 02_Areas folder ID from project
   * @param areaCode - Area code (e.g., "GF-LOBBY")
   * @returns Area folder ID, code, and v1 folder ID
   */
  async createAreaFolder(
    areasFolderId: string,
    areaCode: string
  ): Promise<AreaFolderResult> {
    // Create area folder
    const areaFolder = await this.createFolder(areaCode, areasFolderId)

    // Create v1 folder with Working and Output subfolders
    const v1Folder = await this.createFolder('v1', areaFolder.id!)
    await this.createFolder('Working', v1Folder.id!)
    await this.createFolder('Output', v1Folder.id!)

    return {
      areaFolderId: areaFolder.id!,
      areaCode,
      versionFolderId: v1Folder.id!,
    }
  }

  /**
   * Create a version folder inside an area folder
   * Structure: {areaFolder}/v{N}/[Working, Output]
   *
   * @param areaFolderId - The area folder ID
   * @param versionNumber - Version number (e.g., 2)
   * @returns Version folder ID and number
   */
  async createAreaVersionFolder(
    areaFolderId: string,
    versionNumber: number
  ): Promise<AreaVersionFolderResult> {
    // Create version folder
    const versionFolder = await this.createFolder(`v${versionNumber}`, areaFolderId)

    // Create Working and Output subfolders
    await this.createFolder('Working', versionFolder.id!)
    await this.createFolder('Output', versionFolder.id!)

    return {
      versionFolderId: versionFolder.id!,
      versionNumber,
    }
  }

  /**
   * Delete a version folder from an area (with retry)
   *
   * @param versionFolderId - Version folder ID to delete
   */
  async deleteAreaVersionFolder(versionFolderId: string): Promise<void> {
    await this.withRetry(
      () => this.drive.files.delete({
        fileId: versionFolderId,
        supportsAllDrives: true,
      }),
      3,
      'Delete area version folder'
    )
  }

  /**
   * Delete an area folder (with retry)
   *
   * @param areaFolderId - Area folder ID to delete
   */
  async deleteAreaFolder(areaFolderId: string): Promise<void> {
    await this.withRetry(
      () => this.drive.files.delete({
        fileId: areaFolderId,
        supportsAllDrives: true,
      }),
      3,
      'Delete area folder'
    )
  }

  /**
   * Get the 02_Areas folder ID from a project folder
   * Used when project was created before this update
   *
   * @param projectFolderId - Project folder ID
   * @returns Areas folder ID or null if not found
   */
  async getAreasFolderId(projectFolderId: string): Promise<string | null> {
    const files = await this.listFiles(projectFolderId)
    const areasFolder = files.find((f) => f.name === '02_Areas' && f.isFolder)
    return areasFolder?.id || null
  }

  /**
   * Create a new version by copying the current version folder
   *
   * @param projectFolderId - Project root folder ID
   * @param currentVersionFolderId - Current version folder ID to copy from
   * @param newVersionNumber - New version number (e.g., 2)
   * @returns New version folder ID
   */
  async createVersion(
    projectFolderId: string,
    currentVersionFolderId: string,
    newVersionNumber: number
  ): Promise<VersionFolderResult> {
    const newFolderName = `v${newVersionNumber}`

    // Copy the entire folder structure recursively
    const newVersionFolderId = await this.copyFolderRecursive(
      currentVersionFolderId,
      projectFolderId,
      newFolderName
    )

    return {
      versionFolderId: newVersionFolderId,
      versionNumber: newVersionNumber,
    }
  }

  /**
   * Delete a version folder (with retry)
   *
   * @param versionFolderId - Version folder ID to delete
   */
  async deleteVersion(versionFolderId: string): Promise<void> {
    await this.withRetry(
      () => this.drive.files.delete({
        fileId: versionFolderId,
        supportsAllDrives: true,
      }),
      3,
      'Delete version folder'
    )
  }

  /**
   * Delete a project folder and all its contents (with retry)
   *
   * @param projectFolderId - Project folder ID to delete
   */
  async deleteProject(projectFolderId: string): Promise<void> {
    await this.withRetry(
      () => this.drive.files.delete({
        fileId: projectFolderId,
        supportsAllDrives: true,
      }),
      3,
      'Delete project folder'
    )
  }

  /**
   * List files in a folder
   *
   * @param folderId - Folder ID to list
   * @returns Array of files/folders
   */
  async listFiles(folderId: string): Promise<DriveFile[]> {
    const response = await this.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      driveId: this.hubDriveId,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'drive',
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
      orderBy: 'folder,name',
    })

    const files = response.data.files || []

    return files.map((file) => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size || undefined,
      modifiedTime: file.modifiedTime || undefined,
      webViewLink: file.webViewLink || undefined,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    }))
  }

  /**
   * Get folder metadata
   *
   * @param folderId - Folder ID
   * @returns Folder metadata
   */
  async getFolder(folderId: string): Promise<DriveFile> {
    const response = await this.drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType, modifiedTime, webViewLink',
      supportsAllDrives: true,
    })

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      modifiedTime: response.data.modifiedTime || undefined,
      webViewLink: response.data.webViewLink || undefined,
      isFolder: response.data.mimeType === 'application/vnd.google-apps.folder',
    }
  }

  /**
   * Get the web link for a folder (for "Open in Drive" button)
   *
   * @param folderId - Folder ID
   * @returns Web URL
   */
  getFolderWebLink(folderId: string): string {
    return `https://drive.google.com/drive/folders/${folderId}`
  }

  // ─────────────────────────────────────────────────────────────
  // Private helper methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a folder in Google Drive (with retry on rate limit/server errors)
   */
  private async createFolder(
    name: string,
    parentId: string
  ): Promise<drive_v3.Schema$File> {
    return this.withRetry(
      async () => {
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
      },
      3,
      `Create folder "${name}"`
    )
  }

  /**
   * Create skeleton folder structure with subfolders
   * Returns map of top-level folder names to their IDs
   *
   * Note: README files skipped for now due to service account limitations
   * Files can be uploaded later by users through Google Drive UI
   */
  private async createSkeletonStructure(
    parentFolderId: string
  ): Promise<Record<string, string>> {
    const folderIds: Record<string, string> = {}

    for (const [topFolder, subFolders] of Object.entries(SKELETON_STRUCTURE)) {
      // Create top-level folder
      const folder = await this.createFolder(topFolder, parentFolderId)
      folderIds[topFolder] = folder.id!

      // Create subfolders
      for (const subFolder of subFolders) {
        await this.createFolder(subFolder, folder.id!)
      }

      // NOTE: README files temporarily disabled
      // Service accounts have issues uploading files with content
      // Users can add files through Google Drive UI
    }

    return folderIds
  }

  /**
   * Create a text file in Google Drive (Shared Drive compatible)
   * Note: For Shared Drives, the parent must be within the Shared Drive
   * and supportsAllDrives must be true. Do NOT set driveId in requestBody.
   */
  private async createTextFile(
    name: string,
    content: string,
    parentId: string
  ): Promise<drive_v3.Schema$File> {
    const { Readable } = await import('stream')
    const stream = Readable.from([content])

    const response = await this.drive.files.create({
      requestBody: {
        name,
        parents: [parentId],
      },
      media: {
        mimeType: 'text/plain',
        body: stream,
      },
      supportsAllDrives: true,
      fields: 'id, name',
    })

    return response.data
  }

  /**
   * Copy a folder and all its contents recursively
   */
  private async copyFolderRecursive(
    sourceFolderId: string,
    destinationParentId: string,
    newFolderName: string
  ): Promise<string> {
    // Create new folder
    const newFolder = await this.createFolder(newFolderName, destinationParentId)

    // List all items in source folder
    const items = await this.listFiles(sourceFolderId)

    // Copy each item
    for (const item of items) {
      if (item.isFolder) {
        // Recursively copy subfolder
        await this.copyFolderRecursive(item.id, newFolder.id!, item.name)
      } else {
        // Copy file
        await this.drive.files.copy({
          fileId: item.id,
          requestBody: {
            name: item.name,
            parents: [newFolder.id!],
          },
          supportsAllDrives: true,
        })
      }
    }

    return newFolder.id!
  }
}

// Export singleton instance
let serviceInstance: GoogleDriveProjectService | null = null

export function getGoogleDriveProjectService(): GoogleDriveProjectService {
  if (!serviceInstance) {
    serviceInstance = new GoogleDriveProjectService()
  }
  return serviceInstance
}

// Also export class for testing
export { GoogleDriveProjectService }
