'use server'

/**
 * Planner Server Actions
 *
 * Handles floor plan upload, caching, and database operations
 */

import { supabaseServer } from '@fossapp/core/db/server'
import {
  prepareFloorPlan,
  getTranslationStatus,
  getViewerToken,
  generateBucketName,
  deleteProjectBucket
} from './aps-planner-service'

// ============================================================================
// INTERFACES
// ============================================================================

export interface FloorPlanInfo {
  urn: string
  filename: string
  fileHash: string
  bucketName: string
}

export interface UploadResult {
  success: boolean
  urn?: string
  isNewUpload?: boolean
  error?: string
}

export interface TranslationStatusResult {
  success: boolean
  status?: 'pending' | 'inprogress' | 'success' | 'failed'
  progress?: string
  messages?: string[]
  error?: string
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Check if a floor plan with this hash already exists in any project
 * Returns the URN if found
 */
async function checkFloorPlanCache(hash: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .schema('projects')
    .from('projects')
    .select('floor_plan_urn')
    .eq('floor_plan_hash', hash)
    .not('floor_plan_urn', 'is', null)
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data.floor_plan_urn
}

/**
 * Get floor plan info for a project
 */
export async function getProjectFloorPlan(projectId: string): Promise<FloorPlanInfo | null> {
  const { data, error } = await supabaseServer
    .schema('projects')
    .from('projects')
    .select('floor_plan_urn, floor_plan_filename, floor_plan_hash, oss_bucket')
    .eq('id', projectId)
    .single()

  if (error || !data || !data.floor_plan_urn) {
    return null
  }

  return {
    urn: data.floor_plan_urn,
    filename: data.floor_plan_filename || 'floor_plan.dwg',
    fileHash: data.floor_plan_hash || '',
    bucketName: data.oss_bucket || generateBucketName(projectId)
  }
}

// ============================================================================
// UPLOAD OPERATIONS
// ============================================================================

/**
 * Upload and process floor plan for a project
 *
 * 1. Checks cache by file hash (instant if already translated)
 * 2. Creates project bucket if needed
 * 3. Uploads to OSS
 * 4. Starts SVF2 translation
 * 5. Saves URN to database
 */
export async function uploadFloorPlanAction(
  projectId: string,
  fileName: string,
  fileBase64: string
): Promise<UploadResult> {
  try {
    // Validate project ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(projectId)) {
      return { success: false, error: 'Invalid project ID format' }
    }

    // Validate filename
    if (!fileName.toLowerCase().endsWith('.dwg')) {
      return { success: false, error: 'Only DWG files are supported' }
    }

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(fileBase64, 'base64')

    if (fileBuffer.length === 0) {
      return { success: false, error: 'Empty file' }
    }

    console.log(`[Planner Action] Processing ${fileName} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB) for project ${projectId}`)

    // Prepare floor plan (with cache check)
    const result = await prepareFloorPlan(
      projectId,
      fileName,
      fileBuffer,
      checkFloorPlanCache
    )

    // Save to database
    const { error: updateError } = await supabaseServer
      .schema('projects')
      .from('projects')
      .update({
        floor_plan_urn: result.urn,
        floor_plan_filename: fileName,
        floor_plan_hash: result.fileHash,
        oss_bucket: result.bucketName,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)

    if (updateError) {
      console.error('[Planner Action] Database update error:', updateError)
      return { success: false, error: 'Failed to save floor plan info' }
    }

    console.log(`[Planner Action] Floor plan saved. New upload: ${result.isNewUpload}`)

    return {
      success: true,
      urn: result.urn,
      isNewUpload: result.isNewUpload
    }
  } catch (error) {
    console.error('[Planner Action] Upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}

// ============================================================================
// TRANSLATION STATUS
// ============================================================================

/**
 * Get translation status for a URN
 */
export async function getFloorPlanTranslationStatus(urn: string): Promise<TranslationStatusResult> {
  try {
    const status = await getTranslationStatus(urn)
    return {
      success: true,
      ...status
    }
  } catch (error) {
    console.error('[Planner Action] Translation status error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    }
  }
}

// ============================================================================
// VIEWER TOKEN
// ============================================================================

/**
 * Get viewer token for client-side viewer
 */
export async function getFloorPlanViewerToken(): Promise<{
  success: boolean
  accessToken?: string
  expiresIn?: number
  error?: string
}> {
  try {
    const token = await getViewerToken()
    return {
      success: true,
      accessToken: token.access_token,
      expiresIn: token.expires_in
    }
  } catch (error) {
    console.error('[Planner Action] Viewer token error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get viewer token'
    }
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Clear floor plan from a project (but keep the bucket for potential future use)
 */
export async function clearProjectFloorPlan(projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseServer
      .schema('projects')
      .from('projects')
      .update({
        floor_plan_urn: null,
        floor_plan_filename: null,
        floor_plan_hash: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)

    if (error) {
      return { success: false, error: 'Failed to clear floor plan' }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear floor plan'
    }
  }
}

/**
 * Delete project's OSS bucket (called when project is deleted)
 */
export async function deleteProjectOssBucket(projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteProjectBucket(projectId)
    return { success: true }
  } catch (error) {
    console.error('[Planner Action] Delete bucket error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete bucket'
    }
  }
}
