'use server'

/**
 * Project + Google Drive Combined Actions
 *
 * These actions handle both database operations and Google Drive operations
 * for project management. They ensure consistency between DB and Drive.
 */

import { supabaseServer } from '../supabase-server'
import { getGoogleDriveProjectService } from '../google-drive-project-service'
import { validateProjectId } from './validation'
import type { ActionResult, CreateProjectInput } from './projects'

// ============================================================================
// CREATE PROJECT WITH DRIVE FOLDER
// ============================================================================

export interface CreateProjectWithDriveInput extends Omit<CreateProjectInput, 'project_code'> {
  // project_code will be auto-generated
  created_by?: string  // User name who creates the project
}

export interface CreateProjectWithDriveResult {
  id: string
  project_code: string
  google_drive_folder_id: string
  version_folder_id: string
}

/**
 * Create a new project with auto-generated code and Google Drive folder
 *
 * Flow:
 * 1. Generate project code (YYMM-NNN)
 * 2. Create project in database
 * 3. Create folder structure in Google Drive
 * 4. Update project with Drive folder ID
 * 5. Create v1 record in project_versions
 */
export async function createProjectWithDriveAction(
  input: CreateProjectWithDriveInput
): Promise<ActionResult<CreateProjectWithDriveResult>> {
  let projectId: string | null = null
  let driveFolderId: string | null = null

  try {
    // 1. Generate project code
    const { data: codeData, error: codeError } = await supabaseServer
      .schema('projects')
      .rpc('generate_project_code')

    if (codeError || !codeData) {
      console.error('Generate project code error:', codeError)
      return { success: false, error: 'Failed to generate project code' }
    }

    const projectCode = codeData as string

    // 2. Create project in database
    const { data: project, error: projectError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .insert({
        project_code: projectCode,
        name: input.name.trim(),
        name_en: input.name_en?.trim() || null,
        description: input.description?.trim() || null,
        customer_id: input.customer_id || null,
        street_address: input.street_address?.trim() || null,
        postal_code: input.postal_code?.trim() || null,
        city: input.city?.trim() || null,
        region: input.region?.trim() || null,
        prefecture: input.prefecture?.trim() || null,
        country: input.country?.trim() || 'Greece',
        project_type: input.project_type || null,
        project_category: input.project_category || null,
        building_area_sqm: input.building_area_sqm || null,
        estimated_budget: input.estimated_budget || null,
        currency: input.currency || 'EUR',
        status: input.status || 'draft',
        priority: input.priority || 'medium',
        start_date: input.start_date || null,
        expected_completion_date: input.expected_completion_date || null,
        project_manager: input.project_manager?.trim() || null,
        architect_firm: input.architect_firm?.trim() || null,
        electrical_engineer: input.electrical_engineer?.trim() || null,
        lighting_designer: input.lighting_designer?.trim() || null,
        notes: input.notes?.trim() || null,
        tags: input.tags || null,
        is_archived: false,
      })
      .select('id')
      .single()

    if (projectError || !project) {
      console.error('Create project error:', projectError)
      return { success: false, error: 'Failed to create project in database' }
    }

    projectId = project.id

    // 3. Create folder structure in Google Drive
    const driveService = getGoogleDriveProjectService()
    const driveResult = await driveService.createProjectFolder(projectCode)

    // Store folder ID for potential rollback (currently unused but kept for future use)
    driveFolderId = driveResult.projectFolderId // eslint-disable-line @typescript-eslint/no-unused-vars

    // 4. Update project with Drive folder ID
    const { error: updateError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .update({
        google_drive_folder_id: driveResult.projectFolderId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)

    if (updateError) {
      console.error('Update project drive folder error:', updateError)
      // Continue anyway - folder was created
    }

    // Note: Project versioning removed. Version folders are now managed at area level.
    // See project-areas.ts for area-level versioning.

    return {
      success: true,
      data: {
        id: projectId!,
        project_code: projectCode,
        google_drive_folder_id: driveResult.projectFolderId,
        version_folder_id: '', // Deprecated - versioning is now at area level
      },
    }
  } catch (error) {
    console.error('Create project with drive error:', error)

    // Cleanup on failure - try to delete the project if it was created
    if (projectId) {
      try {
        await supabaseServer
          .schema('projects')
          .from('projects')
          .delete()
          .eq('id', projectId)
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError)
      }
    }

    // Note: We don't delete the Drive folder on failure - manual cleanup may be needed
    // This is intentional to avoid data loss

    return { success: false, error: 'Failed to create project' }
  }
}

// ============================================================================
// CREATE NEW VERSION (DEPRECATED - use area-level versioning)
// ============================================================================

export interface CreateVersionResult {
  version_id: string
  version_number: number
  google_drive_folder_id: string
}

/**
 * @deprecated Project-level versioning has been removed.
 * Use area-level versioning instead (see project-areas.ts).
 */
export async function createProjectVersionWithDriveAction(
  _projectId: string,
  _notes?: string,
  _createdBy?: string
): Promise<ActionResult<CreateVersionResult>> {
  return {
    success: false,
    error: 'Project-level versioning has been removed. Use area-level versioning instead.'
  }
}

// ============================================================================
// ARCHIVE PROJECT
// ============================================================================

/**
 * Archive a project - move Drive folder to Archive and mark as archived
 *
 * Flow:
 * 1. Get project info
 * 2. Move folder to Archive in Google Drive
 * 3. Set is_archived = true in DB
 */
export async function archiveProjectWithDriveAction(
  projectId: string
): Promise<ActionResult> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    // 1. Get project info
    const { data: project, error: projectError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select('id, google_drive_folder_id, is_archived')
      .eq('id', sanitizedProjectId)
      .single()

    if (projectError || !project) {
      console.error('Get project error:', projectError)
      return { success: false, error: 'Project not found' }
    }

    if (project.is_archived) {
      return { success: false, error: 'Project is already archived' }
    }

    // 2. Move folder to Archive in Google Drive
    if (project.google_drive_folder_id) {
      try {
        const driveService = getGoogleDriveProjectService()
        await driveService.archiveProject(project.google_drive_folder_id)
      } catch (driveError) {
        console.error('Archive drive folder error:', driveError)
        // Continue with DB update even if Drive fails
      }
    }

    // 3. Set is_archived = true in DB
    const { error: updateError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .update({
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sanitizedProjectId)

    if (updateError) {
      console.error('Update project archived status error:', updateError)
      return { success: false, error: 'Failed to archive project' }
    }

    return { success: true }
  } catch (error) {
    console.error('Archive project with drive error:', error)
    return { success: false, error: 'Failed to archive project' }
  }
}

// ============================================================================
// DELETE VERSION (DEPRECATED - use area-level versioning)
// ============================================================================

/**
 * @deprecated Project-level versioning has been removed.
 * Use area-level versioning instead (see deleteAreaVersionAction in project-areas.ts).
 */
export async function deleteProjectVersionWithDriveAction(
  _projectId: string,
  _versionNumber: number
): Promise<ActionResult> {
  return {
    success: false,
    error: 'Project-level versioning has been removed. Use area-level versioning instead.'
  }
}

// ============================================================================
// GET DRIVE FOLDER LINK
// ============================================================================

/**
 * Get the Google Drive web link for a project or version folder
 */
export async function getProjectDriveLinkAction(folderId: string): Promise<string> {
  return `https://drive.google.com/drive/folders/${folderId}`
}

// ============================================================================
// LIST VERSION FILES
// ============================================================================

export interface DriveFileInfo {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  webViewLink?: string
  isFolder: boolean
}

/**
 * List files in a version folder
 */
export async function listVersionFilesAction(
  versionFolderId: string
): Promise<ActionResult<DriveFileInfo[]>> {
  try {
    const driveService = getGoogleDriveProjectService()
    const files = await driveService.listFiles(versionFolderId)

    return {
      success: true,
      data: files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink,
        isFolder: f.isFolder,
      })),
    }
  } catch (error) {
    console.error('List version files error:', error)
    return { success: false, error: 'Failed to list files' }
  }
}
