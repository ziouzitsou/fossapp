/**
 * Google Drive Project Service
 *
 * Handles all Google Drive operations for project management:
 * - Create project folder structure
 * - Create new versions (copy folder)
 * - Archive projects
 * - Delete projects
 * - Delete versions
 * - List files
 *
 * Uses Service Account authentication (no user tokens needed)
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

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  webViewLink?: string
  isFolder: boolean
}

export interface ProjectFolderResult {
  projectFolderId: string
  areasFolderId: string // ID of the 02_Areas folder for creating area subfolders
}

export interface AreaFolderResult {
  areaFolderId: string
  areaCode: string
  versionFolderId: string // ID of the v1 folder created inside the area
}

export interface AreaVersionFolderResult {
  versionFolderId: string
  versionNumber: number
}

// Deprecated - project-level versioning removed
export interface VersionFolderResult {
  versionFolderId: string
  versionNumber: number
}

class GoogleDriveProjectService {
  private drive: drive_v3.Drive
  private hubDriveId: string
  private projectsFolderId: string
  private archiveFolderId: string

  constructor() {
    // Load environment variables
    this.hubDriveId = getEnvVar('GOOGLE_DRIVE_HUB_ID')
    this.projectsFolderId = getEnvVar('GOOGLE_DRIVE_PROJECTS_FOLDER_ID')
    this.archiveFolderId = getEnvVar('GOOGLE_DRIVE_ARCHIVE_FOLDER_ID')

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
   * Delete a version folder from an area
   *
   * @param versionFolderId - Version folder ID to delete
   */
  async deleteAreaVersionFolder(versionFolderId: string): Promise<void> {
    await this.drive.files.delete({
      fileId: versionFolderId,
      supportsAllDrives: true,
    })
  }

  /**
   * Delete an area folder
   *
   * @param areaFolderId - Area folder ID to delete
   */
  async deleteAreaFolder(areaFolderId: string): Promise<void> {
    await this.drive.files.delete({
      fileId: areaFolderId,
      supportsAllDrives: true,
    })
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
   * Archive a project by moving it to the Archive folder
   *
   * @param projectFolderId - Project folder ID to archive
   */
  async archiveProject(projectFolderId: string): Promise<void> {
    // Get current parents
    const file = await this.drive.files.get({
      fileId: projectFolderId,
      fields: 'parents',
      supportsAllDrives: true,
    })

    const previousParents = file.data.parents?.join(',') || ''

    // Move to Archive folder
    await this.drive.files.update({
      fileId: projectFolderId,
      addParents: this.archiveFolderId,
      removeParents: previousParents,
      supportsAllDrives: true,
    })
  }

  /**
   * Delete a version folder
   *
   * @param versionFolderId - Version folder ID to delete
   */
  async deleteVersion(versionFolderId: string): Promise<void> {
    await this.drive.files.delete({
      fileId: versionFolderId,
      supportsAllDrives: true,
    })
  }

  /**
   * Delete a project folder and all its contents
   *
   * @param projectFolderId - Project folder ID to delete
   */
  async deleteProject(projectFolderId: string): Promise<void> {
    await this.drive.files.delete({
      fileId: projectFolderId,
      supportsAllDrives: true,
    })
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
   * Create a folder in Google Drive
   */
  private async createFolder(
    name: string,
    parentId: string
  ): Promise<drive_v3.Schema$File> {
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
