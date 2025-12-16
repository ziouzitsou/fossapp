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

// Skeleton folder structure
const SKELETON_FOLDERS = ['01_Input', '02_Working', '03_Output', '04_Specs']

// README content for each folder
const README_CONTENT: Record<string, string> = {
  '01_Input': `# Input Files

Place customer-provided files here:

- Original AutoCAD drawings (DWG)
- Reference PDFs
- Site photos
- Floor plans
- Any source material from customer

---

*This folder is part of the FOSSAPP project template.*
`,
  '02_Working': `# Working Files

Engineer work-in-progress files:

- Cleaned AutoCAD drawings
- Draft layouts
- Work files (not final)
- Intermediate versions

---

*This folder is part of the FOSSAPP project template.*
`,
  '03_Output': `# Output Files

Final deliverables for customer:

- Printed PDFs
- Final AutoCAD files
- Presentation materials
- Lighting schedules
- Final layouts

---

*This folder is part of the FOSSAPP project template.*
`,
  '04_Specs': `# Specifications

Product documentation:

- Cut sheets
- Technical data sheets
- IES/LDT photometric files
- Installation guides
- Product images

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
  versionFolderId: string
}

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
   * Creates: Projects/{projectCode}/v1/{skeleton folders}
   *
   * @param projectCode - Project code (e.g., "2512-001")
   * @returns Project folder ID and version 1 folder ID
   */
  async createProjectFolder(projectCode: string): Promise<ProjectFolderResult> {
    // 1. Create project root folder
    const projectFolder = await this.createFolder(projectCode, this.projectsFolderId)

    // 2. Create v1 folder
    const v1Folder = await this.createFolder('v1', projectFolder.id!)

    // 3. Create skeleton subfolders with README files
    await this.createSkeletonStructure(v1Folder.id!)

    return {
      projectFolderId: projectFolder.id!,
      versionFolderId: v1Folder.id!,
    }
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
   * Create skeleton folder structure
   * Note: README files skipped for now due to service account limitations
   * Files can be uploaded later by users through Google Drive UI
   */
  private async createSkeletonStructure(parentFolderId: string): Promise<void> {
    for (const folderName of SKELETON_FOLDERS) {
      // Create subfolder
      await this.createFolder(folderName, parentFolderId)

      // NOTE: README files temporarily disabled
      // Service accounts have issues uploading files with content
      // Users can add files through Google Drive UI
    }
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
