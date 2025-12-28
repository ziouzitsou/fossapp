'use server'

/**
 * Project Utility Actions
 *
 * Utility operations for projects:
 * - Generate project code
 * - Update Google Drive folder
 */

import { supabaseServer } from '@fossapp/core/db/server'
import { validateProjectId } from '@fossapp/core/validation'

import type { ActionResult } from '@fossapp/projects'

// ============================================================================
// GENERATE PROJECT CODE
// ============================================================================

/**
 * Generate the next project code using the database function
 * Format: YYMM-NNN (e.g., 2512-001)
 */
export async function generateProjectCodeAction(): Promise<ActionResult<{ project_code: string }>> {
  try {
    const { data, error } = await supabaseServer
      .schema('projects')
      .rpc('generate_project_code')

    if (error) {
      console.error('Generate project code error:', error)
      return { success: false, error: 'Failed to generate project code' }
    }

    return { success: true, data: { project_code: data } }
  } catch (error) {
    console.error('Generate project code error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// UPDATE PROJECT GOOGLE DRIVE FOLDER
// ============================================================================

export async function updateProjectDriveFolderAction(
  projectId: string,
  googleDriveFolderId: string
): Promise<ActionResult> {
  try {
    const sanitizedProjectId = validateProjectId(projectId)

    const { error } = await supabaseServer
      .schema('projects')
      .from('projects')
      .update({
        google_drive_folder_id: googleDriveFolderId,
        updated_at: new Date().toISOString()
      })
      .eq('id', sanitizedProjectId)

    if (error) {
      console.error('Update project drive folder error:', error)
      return { success: false, error: 'Failed to update project drive folder' }
    }

    return { success: true }
  } catch (error) {
    console.error('Update project drive folder error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
