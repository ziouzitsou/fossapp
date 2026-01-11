/**
 * APS Design Automation Service for Planner (Optimized)
 *
 * Processes user-uploaded DWGs through FOSS.dwt template for standardized
 * layer structure, units, and drawing settings.
 *
 * Optimized Workflow (uses persistent bucket only):
 * 1. Upload: user's DWG (as input.dwg) + import.scr to _temp/{sessionId}/
 * 2. Create/reuse Activity (fossappPlannerAct)
 * 3. Submit WorkItem (template already in bucket, output goes to final location)
 * 4. Poll for completion
 * 5. Clean up temp files
 * 6. Return URN (no download/re-upload needed!)
 *
 * @module planner/design-automation-service
 * @see {@link https://aps.autodesk.com/en/docs/design-automation/v3/} DA Docs
 */

import { APSAuthService } from '../tiles/aps/auth-service'
import { APS_CONFIG, DA_BASE_URL } from '../tiles/aps/config'
import {
  TEMPLATE_OBJECT_KEY,
  TEMP_PREFIX,
  generateSignedReadUrl,
  generateSignedWriteUrl,
  uploadBufferToOss,
  cleanupTempFiles,
  deriveUrn,
  hasTemplateInBucket,
  uploadTemplateToProjectBucket
} from './oss-service'
import { getGoogleDriveTemplateService } from './google-drive-template-service'
import crypto from 'crypto'

/** Activity name for planner floor plan processing */
const PLANNER_ACTIVITY_NAME = 'fossappPlannerAct'

/** Progress callback type for UI updates */
export type PlannerProgressCallback = (step: string, detail?: string) => void

/** Result of floor plan processing */
export interface FloorPlanProcessingResult {
  success: boolean
  urn?: string
  objectKey?: string
  workItemId?: string
  report?: string
  errors: string[]
}

/**
 * Service for processing floor plans through APS Design Automation
 *
 * @remarks
 * Uses FOSS.dwt template already uploaded to the project bucket.
 * Template sets: units (mm), layers, drawing settings.
 * User's DWG is inserted and exploded into the template.
 * Output goes directly to the persistent bucket - no download/re-upload!
 *
 * @example
 * ```typescript
 * const service = new PlannerDesignAutomationService()
 * const result = await service.processFloorPlan(
 *   'fossapp_prj_abc123',
 *   userDwgBuffer,
 *   'A01_v1_FloorPlan.dwg'
 * )
 * if (result.success && result.urn) {
 *   // URN ready for translation - no additional upload needed!
 * }
 * ```
 */
export class PlannerDesignAutomationService {
  private authService = new APSAuthService()

  /**
   * Process a floor plan DWG through the FOSS.dwt template
   *
   * @param bucketName - Project's persistent bucket (already has foss.dwt)
   * @param userDwgBuffer - User's uploaded DWG file buffer
   * @param outputObjectKey - Output object key (e.g., "A01_v1_FloorPlan.dwg")
   * @param onProgress - Optional callback for progress updates
   * @returns Processing result with URN on success (ready for translation)
   */
  async processFloorPlan(
    bucketName: string,
    userDwgBuffer: Buffer,
    outputObjectKey: string,
    onProgress?: PlannerProgressCallback
  ): Promise<FloorPlanProcessingResult> {
    const errors: string[] = []
    const sessionId = crypto.randomUUID().substring(0, 8)

    const startTime = Date.now()
    const log = (step: string, detail?: string) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[Planner DA] [${elapsed}s] ${step}${detail ? ` → ${detail}` : ''}`)
      onProgress?.(step, detail)
    }

    try {
      console.log('\n' + '='.repeat(60))
      console.log('[Planner DA] STARTING DESIGN AUTOMATION PROCESSING (Optimized)')
      console.log(`[Planner DA] Bucket: ${bucketName}`)
      console.log(`[Planner DA] Output: ${outputObjectKey}`)
      console.log(`[Planner DA] Input DWG: ${(userDwgBuffer.length / 1024).toFixed(0)} KB`)
      console.log(`[Planner DA] Session: ${sessionId}`)
      console.log('='.repeat(60))

      // Step 1: Authenticate
      log('Step 1/5: Authenticating with APS...')
      await this.authService.getAccessToken()
      log('Step 1/5: Authentication complete')

      // Step 2: Create Activity (if not exists)
      log('Step 2/5: Creating activity...')
      await this.createPlannerActivity()
      log('Step 2/5: Activity ready')

      // Step 3: Upload temp files + ensure template exists
      log('Step 3/5: Preparing files...', 'checking template + uploading input')
      const urls = await this.uploadTempFiles(bucketName, sessionId, userDwgBuffer)
      log('Step 3/5: Files ready')

      // Step 4: Submit WorkItem (output goes directly to final location)
      log('Step 4/5: Submitting WorkItem to APS...')
      const workItemResult = await this.submitWorkItem(bucketName, urls, outputObjectKey)
      log('Step 4/5: WorkItem submitted', workItemResult.workItemId)

      // Step 5: Monitor WorkItem
      log('Step 5/5: Running AutoCAD in cloud...', 'this may take 15-30s')
      const monitorResult = await this.monitorWorkItem(workItemResult.workItemId, (elapsed) => {
        log('Step 5/5: AutoCAD processing...', `${elapsed}s elapsed`)
      })

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
      const urn = deriveUrn(bucketName, outputObjectKey)

      console.log('='.repeat(60))
      console.log(`[Planner DA] ✓ PROCESSING COMPLETE in ${totalTime}s`)
      console.log(`[Planner DA] Output: ${bucketName}/${outputObjectKey}`)
      console.log(`[Planner DA] URN: ${urn.substring(0, 30)}...`)
      console.log('='.repeat(60) + '\n')

      return {
        success: true,
        urn,
        objectKey: outputObjectKey,
        workItemId: workItemResult.workItemId,
        report: monitorResult.report,
        errors,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(errorMessage)
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log('='.repeat(60))
      console.log(`[Planner DA] ✗ PROCESSING FAILED after ${totalTime}s`)
      console.log(`[Planner DA] Error: ${errorMessage}`)
      console.log('='.repeat(60) + '\n')

      return {
        success: false,
        errors,
      }
    } finally {
      // Cleanup: delete temp files and activity
      try {
        log('Cleanup: Removing temp files...')
        await cleanupTempFiles(bucketName, sessionId)
        await this.deleteActivity()
        log('Cleanup complete')
      } catch (e) {
        console.warn('Cleanup warning:', e)
      }
    }
  }

  /**
   * Create the Planner Activity for floor plan processing
   *
   * @remarks
   * Activity defines:
   * - Command line: accoreconsole.exe /i template /s script
   * - Parameters: template, input, script (get), output (put)
   *
   * The /i switch opens a new drawing based on the template.
   * The /s switch runs the import script.
   */
  private async createPlannerActivity(): Promise<void> {
    const accessToken = await this.authService.getAccessToken()
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    const activitySpec = {
      id: PLANNER_ACTIVITY_NAME,
      engine: APS_CONFIG.engineVersion,
      commandLine: [
        `$(engine.path)\\accoreconsole.exe /i "$(args[template].path)" /s "$(args[script].path)"`,
      ],
      parameters: {
        template: {
          verb: 'get',
          description: 'FOSS.dwt template file',
          required: true,
          localName: 'foss.dwt',
        },
        input: {
          verb: 'get',
          description: "User's DWG file to import",
          required: true,
          localName: 'input.dwg',
        },
        script: {
          verb: 'get',
          description: 'Import script',
          required: true,
          localName: 'import.scr',
        },
        output: {
          verb: 'put',
          description: 'Processed DWG output',
          required: true,
          localName: 'output.dwg',
        },
      },
      description: 'Process floor plan DWG through FOSS.dwt template',
    }

    // Create Activity
    const createResponse = await fetch(`${DA_BASE_URL}/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify(activitySpec),
    })

    if (!createResponse.ok && createResponse.status !== 409) {
      const errorText = await createResponse.text()
      throw new Error(`Failed to create activity: ${errorText}`)
    }

    // If activity exists (409), delete and recreate
    if (createResponse.status === 409) {
      await this.deleteActivity()
      const retryResponse = await fetch(`${DA_BASE_URL}/activities`, {
        method: 'POST',
        headers,
        body: JSON.stringify(activitySpec),
      })
      if (!retryResponse.ok) {
        const errorText = await retryResponse.text()
        throw new Error(`Failed to recreate activity: ${errorText}`)
      }
    }

    // Create production alias
    const aliasResponse = await fetch(
      `${DA_BASE_URL}/activities/${encodeURIComponent(PLANNER_ACTIVITY_NAME)}/aliases`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: 'production', version: 1 }),
      }
    )

    // Ignore 409 (alias exists)
    if (!aliasResponse.ok && aliasResponse.status !== 409) {
      console.warn(`Alias creation warning: ${await aliasResponse.text()}`)
    }
  }

  /**
   * Delete the Planner Activity
   */
  private async deleteActivity(): Promise<void> {
    try {
      const accessToken = await this.authService.getAccessToken()
      const response = await fetch(
        `${DA_BASE_URL}/activities/${encodeURIComponent(PLANNER_ACTIVITY_NAME)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      if (!response.ok && response.status !== 404 && response.status !== 204) {
        console.warn(`Activity deletion warning: ${response.status}`)
      }
    } catch (error) {
      console.warn('Activity cleanup error:', error)
    }
  }

  /**
   * Upload user DWG and script to temp location in persistent bucket
   * Returns signed URLs for DA to read
   *
   * @remarks
   * Also ensures FOSS.dwt template exists in the bucket. If missing (e.g., failed
   * during project creation), it's fetched from Google Drive and uploaded on-demand.
   */
  private async uploadTempFiles(
    bucketName: string,
    sessionId: string,
    userDwgBuffer: Buffer
  ): Promise<{
    templateUrl: string
    inputUrl: string
    scriptUrl: string
  }> {
    const tempPrefix = `${TEMP_PREFIX}/${sessionId}`
    const scriptContent = this.generateImportScript()

    // Check if template exists in bucket, upload if missing
    const templateExists = await hasTemplateInBucket(bucketName)
    if (!templateExists) {
      console.log(`[Planner DA] Template missing from ${bucketName}, uploading from Google Drive...`)
      const templateService = getGoogleDriveTemplateService()
      const templateBuffer = await templateService.fetchFossTemplate()
      await uploadTemplateToProjectBucket(bucketName, templateBuffer)
      console.log(`[Planner DA] Template uploaded successfully`)
    }

    // Upload input.dwg and import.scr to temp location (parallel)
    const [inputUrl, scriptUrl] = await Promise.all([
      uploadBufferToOss(bucketName, `${tempPrefix}/input.dwg`, userDwgBuffer),
      uploadBufferToOss(bucketName, `${tempPrefix}/import.scr`, Buffer.from(scriptContent, 'utf-8')),
    ])

    // Get signed URL for template (now guaranteed to exist)
    const templateUrl = await generateSignedReadUrl(bucketName, TEMPLATE_OBJECT_KEY)

    return { templateUrl, inputUrl, scriptUrl }
  }

  /**
   * Generate the import script
   *
   * @remarks
   * Script runs after FOSS.dwt is loaded via /i switch:
   * 1. Set headless mode (cmdecho=0, filedia=0)
   * 2. TILEMODE 1 - ensure Model Space (templates may open in Layout)
   * 3. Set current layer to "0"
   * 4. INSERT user's DWG at origin with explicit scales
   * 5. EXPLODE "L" (Last) to merge layers
   * 6. ZOOM extents
   * 7. SAVEAS 2018 format and restore vars
   * 8. QUIT
   */
  private generateImportScript(): string {
    return `; Floor Plan Import Script
; FOSS.dwt template sets units, layers, and drawing settings
(setvar "cmdecho" 0)
(setvar "filedia" 0)
(command "TILEMODE" 1)
(setvar "clayer" "0")
(command "-INSERT" "input.dwg" "0,0,0" "1" "1" "0")
(command "EXPLODE" "L" "")
(command "ZOOM" "E")
(command "SAVEAS" "2018" "output.dwg")
(setvar "filedia" 1)
(setvar "cmdecho" 1)
QUIT
`
  }

  /**
   * Submit a WorkItem to Design Automation
   * Output goes directly to the persistent bucket at the final location
   */
  private async submitWorkItem(
    bucketName: string,
    urls: { templateUrl: string; inputUrl: string; scriptUrl: string },
    outputObjectKey: string
  ): Promise<{ workItemId: string }> {
    const accessToken = await this.authService.getAccessToken()

    // Generate signed write URL for output (goes to final location!)
    const outputUrl = await generateSignedWriteUrl(bucketName, outputObjectKey)

    const activityId = `${APS_CONFIG.nickname}.${PLANNER_ACTIVITY_NAME}+production`

    const workItemSpec = {
      activityId,
      arguments: {
        template: { url: urls.templateUrl, verb: 'get' },
        input: { url: urls.inputUrl, verb: 'get' },
        script: { url: urls.scriptUrl, verb: 'get' },
        output: { url: outputUrl, verb: 'put', localName: 'output.dwg' },
      },
    }

    const response = await fetch(`${DA_BASE_URL}/workitems`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workItemSpec),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`WorkItem submission failed (${response.status}): ${errorData}`)
    }

    const data = (await response.json()) as { id: string }

    return { workItemId: data.id }
  }

  /**
   * Monitor a WorkItem until completion
   */
  private async monitorWorkItem(
    workItemId: string,
    onElapsed?: (elapsed: number) => void
  ): Promise<{ report?: string }> {
    const accessToken = await this.authService.getAccessToken()

    let attempts = 0
    const maxAttempts = APS_CONFIG.maxPollingAttempts
    const startTime = Date.now()

    while (attempts < maxAttempts) {
      const response = await fetch(`${DA_BASE_URL}/workitems/${workItemId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        throw new Error(`Failed to get WorkItem status: ${response.statusText}`)
      }

      const data = (await response.json()) as {
        status: string
        progress?: string
        reportUrl?: string
      }

      if (data.status === 'pending' || data.status === 'inprogress') {
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        onElapsed?.(elapsed)
        await new Promise((resolve) => setTimeout(resolve, 2000))
        attempts++
        continue
      }

      // Get report if available
      let report: string | undefined
      if (data.reportUrl) {
        try {
          const reportResponse = await fetch(data.reportUrl)
          report = await reportResponse.text()
        } catch {
          // Ignore report fetch errors
        }
      }

      if (data.status === 'success') {
        return { report }
      } else {
        const reportSnippet = report ? report.substring(0, 2000) : 'No report available'
        console.error('WorkItem failed. Report:', reportSnippet)
        throw new Error(`WorkItem failed with status: ${data.status}. Report: ${reportSnippet}`)
      }
    }

    throw new Error(`WorkItem processing timeout (${APS_CONFIG.processingTimeoutMinutes} minutes)`)
  }
}
