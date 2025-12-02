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
import type { ActionResult, CreateProjectInput, ProjectVersion } from './projects'

// ============================================================================
// CREATE PROJECT WITH DRIVE FOLDER
// ============================================================================

export interface CreateProjectWithDriveInput extends Omit<CreateProjectInput, 'project_code'> {
  // project_code will be auto-generated
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
        current_version: 1,
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

    driveFolderId = driveResult.projectFolderId

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

    // 5. Create v1 record in project_versions
    const { error: versionError } = await supabaseServer
      .schema('projects')
      .from('project_versions')
      .insert({
        project_id: projectId,
        version_number: 1,
        google_drive_folder_id: driveResult.versionFolderId,
        notes: 'Initial version',
      })

    if (versionError) {
      console.error('Create version record error:', versionError)
      // Continue anyway - project was created
    }

    return {
      success: true,
      data: {
        id: projectId!,
        project_code: projectCode,
        google_drive_folder_id: driveResult.projectFolderId,
        version_folder_id: driveResult.versionFolderId,
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
// CREATE NEW VERSION
// ============================================================================

export interface CreateVersionResult {
  version_id: string
  version_number: number
  google_drive_folder_id: string
}

/**
 * Create a new version by copying the current version folder
 *
 * Flow:
 * 1. Get project and current version info
 * 2. Copy folder in Google Drive
 * 3. Create version record in DB
 * 4. Update current_version on project
 */
export async function createProjectVersionWithDriveAction(
  projectId: string,
  notes?: string
): Promise<ActionResult<CreateVersionResult>> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    // 1. Get project info
    const { data: project, error: projectError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select('id, project_code, google_drive_folder_id, current_version')
      .eq('id', sanitizedProjectId)
      .single()

    if (projectError || !project) {
      console.error('Get project error:', projectError)
      return { success: false, error: 'Project not found' }
    }

    if (!project.google_drive_folder_id) {
      return { success: false, error: 'Project has no Google Drive folder' }
    }

    // Get current version folder ID
    const { data: currentVersion, error: versionError } = await supabaseServer
      .schema('projects')
      .from('project_versions')
      .select('google_drive_folder_id')
      .eq('project_id', sanitizedProjectId)
      .eq('version_number', project.current_version)
      .single()

    if (versionError || !currentVersion?.google_drive_folder_id) {
      console.error('Get current version error:', versionError)
      return { success: false, error: 'Current version folder not found' }
    }

    const newVersionNumber = project.current_version + 1

    // 2. Copy folder in Google Drive
    const driveService = getGoogleDriveProjectService()
    const driveResult = await driveService.createVersion(
      project.google_drive_folder_id,
      currentVersion.google_drive_folder_id,
      newVersionNumber
    )

    // 3. Create version record in DB
    const { data: newVersion, error: createError } = await supabaseServer
      .schema('projects')
      .from('project_versions')
      .insert({
        project_id: sanitizedProjectId,
        version_number: newVersionNumber,
        google_drive_folder_id: driveResult.versionFolderId,
        notes: notes?.trim() || `Version ${newVersionNumber}`,
      })
      .select('id')
      .single()

    if (createError || !newVersion) {
      console.error('Create version record error:', createError)
      return { success: false, error: 'Failed to create version record' }
    }

    // 4. Update current_version on project
    await supabaseServer
      .schema('projects')
      .from('projects')
      .update({
        current_version: newVersionNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sanitizedProjectId)

    return {
      success: true,
      data: {
        version_id: newVersion.id,
        version_number: newVersionNumber,
        google_drive_folder_id: driveResult.versionFolderId,
      },
    }
  } catch (error) {
    console.error('Create version with drive error:', error)
    return { success: false, error: 'Failed to create new version' }
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
// DELETE VERSION
// ============================================================================

/**
 * Delete a project version
 *
 * Flow:
 * 1. Check it's not the only version
 * 2. Delete folder in Google Drive
 * 3. Delete version record in DB
 * 4. Update current_version if needed
 */
export async function deleteProjectVersionWithDriveAction(
  projectId: string,
  versionNumber: number
): Promise<ActionResult> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    // 1. Get all versions count
    const { data: versions, error: versionsError } = await supabaseServer
      .schema('projects')
      .from('project_versions')
      .select('id, version_number, google_drive_folder_id')
      .eq('project_id', sanitizedProjectId)
      .order('version_number', { ascending: false })

    if (versionsError || !versions) {
      console.error('Get versions error:', versionsError)
      return { success: false, error: 'Failed to get project versions' }
    }

    if (versions.length <= 1) {
      return { success: false, error: 'Cannot delete the only version. Delete the project instead.' }
    }

    const versionToDelete = versions.find(v => v.version_number === versionNumber)
    if (!versionToDelete) {
      return { success: false, error: 'Version not found' }
    }

    // 2. Delete folder in Google Drive
    if (versionToDelete.google_drive_folder_id) {
      try {
        const driveService = getGoogleDriveProjectService()
        await driveService.deleteVersion(versionToDelete.google_drive_folder_id)
      } catch (driveError) {
        console.error('Delete drive folder error:', driveError)
        // Continue with DB delete even if Drive fails
      }
    }

    // 3. Delete version record in DB
    const { error: deleteError } = await supabaseServer
      .schema('projects')
      .from('project_versions')
      .delete()
      .eq('id', versionToDelete.id)

    if (deleteError) {
      console.error('Delete version record error:', deleteError)
      return { success: false, error: 'Failed to delete version record' }
    }

    // 4. Update current_version if we deleted the current version
    const { data: project } = await supabaseServer
      .schema('projects')
      .from('projects')
      .select('current_version')
      .eq('id', sanitizedProjectId)
      .single()

    if (project && project.current_version === versionNumber) {
      // Set to the highest remaining version
      const highestRemaining = versions
        .filter(v => v.version_number !== versionNumber)
        .sort((a, b) => b.version_number - a.version_number)[0]

      if (highestRemaining) {
        await supabaseServer
          .schema('projects')
          .from('projects')
          .update({
            current_version: highestRemaining.version_number,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sanitizedProjectId)
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete version with drive error:', error)
    return { success: false, error: 'Failed to delete version' }
  }
}

// ============================================================================
// GET DRIVE FOLDER LINK
// ============================================================================

/**
 * Get the Google Drive web link for a project or version folder
 */
export function getProjectDriveLink(folderId: string): string {
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
