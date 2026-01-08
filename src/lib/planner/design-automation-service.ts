/**
 * APS Design Automation Service for Planner
 *
 * Processes user-uploaded DWGs through FOSS.dwt template for standardized
 * layer structure, units, and drawing settings.
 *
 * Workflow:
 * 1. Create transient bucket
 * 2. Upload: FOSS.dwt template, user's DWG (as input.dwg), import.scr script
 * 3. Create/reuse Activity (fossappPlannerAct)
 * 4. Submit WorkItem
 * 5. Poll for completion
 * 6. Download processed DWG
 * 7. Return buffer for upload to persistent bucket
 *
 * @module planner/design-automation-service
 * @see {@link https://aps.autodesk.com/en/docs/design-automation/v3/} DA Docs
 */

import { APSAuthService } from '../tiles/aps/auth-service'
import { OSSService } from '../tiles/aps/oss-service'
import { APS_CONFIG, DA_BASE_URL } from '../tiles/aps/config'

/** Activity name for planner floor plan processing */
const PLANNER_ACTIVITY_NAME = 'fossappPlannerAct'

/** Progress callback type for UI updates */
export type PlannerProgressCallback = (step: string, detail?: string) => void

/** Result of floor plan processing */
export interface FloorPlanProcessingResult {
  success: boolean
  dwgBuffer?: Buffer
  workItemId?: string
  report?: string
  errors: string[]
}

/**
 * Service for processing floor plans through APS Design Automation
 *
 * @remarks
 * Uses FOSS.dwt template to standardize uploaded floor plans.
 * Template sets: units (mm), layers, drawing settings.
 * User's DWG is inserted and exploded into the template.
 *
 * @example
 * ```typescript
 * const service = new PlannerDesignAutomationService()
 * const result = await service.processFloorPlan(
 *   templateBuffer,
 *   userDwgBuffer,
 *   'Floor_Plan_A1',
 *   (step, detail) => updateProgress(step, detail)
 * )
 * if (result.success && result.dwgBuffer) {
 *   // Upload to persistent bucket...
 * }
 * ```
 */
export class PlannerDesignAutomationService {
  private authService = new APSAuthService()
  private ossService = new OSSService(this.authService)

  /**
   * Process a floor plan DWG through the FOSS.dwt template
   *
   * @param templateBuffer - FOSS.dwt template file buffer
   * @param userDwgBuffer - User's uploaded DWG file buffer
   * @param outputFileName - Output filename (without extension)
   * @param onProgress - Optional callback for progress updates
   * @returns Processing result with DWG buffer on success
   */
  async processFloorPlan(
    templateBuffer: Buffer,
    userDwgBuffer: Buffer,
    outputFileName: string,
    onProgress?: PlannerProgressCallback
  ): Promise<FloorPlanProcessingResult> {
    const errors: string[] = []
    let bucketName: string | null = null

    const startTime = Date.now()
    const log = (step: string, detail?: string) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[Planner DA] [${elapsed}s] ${step}${detail ? ` → ${detail}` : ''}`)
      onProgress?.(step, detail)
    }

    try {
      console.log('\n' + '='.repeat(60))
      console.log('[Planner DA] STARTING DESIGN AUTOMATION PROCESSING')
      console.log(`[Planner DA] Output: ${outputFileName}`)
      console.log(`[Planner DA] Template: ${(templateBuffer.length / 1024).toFixed(0)} KB`)
      console.log(`[Planner DA] Input DWG: ${(userDwgBuffer.length / 1024).toFixed(0)} KB`)
      console.log('='.repeat(60))

      // Step 1: Authenticate
      log('Step 1/7: Authenticating with APS...')
      await this.authService.getAccessToken()
      log('Step 1/7: Authentication complete')

      // Step 2: Create Activity (if not exists)
      log('Step 2/7: Creating activity...')
      await this.createPlannerActivity()
      log('Step 2/7: Activity ready')

      // Step 3: Create temp bucket
      log('Step 3/7: Creating temporary bucket...')
      bucketName = await this.ossService.createTempBucket(`planner-${outputFileName}`)
      log('Step 3/7: Bucket created', bucketName)

      // Step 4: Upload files
      log('Step 4/7: Uploading files to OSS...', '3 files (template + input + script)')
      const uploadResults = await this.uploadFiles(bucketName, templateBuffer, userDwgBuffer)
      log('Step 4/7: Files uploaded')

      // Step 5: Submit WorkItem
      log('Step 5/7: Submitting WorkItem to APS...')
      const workItemResult = await this.submitWorkItem(bucketName, uploadResults, outputFileName)
      log('Step 5/7: WorkItem submitted', workItemResult.workItemId)

      // Step 6: Monitor WorkItem
      log('Step 6/7: Running AutoCAD in cloud...', 'this may take 15-30s')
      const monitorResult = await this.monitorWorkItem(workItemResult.workItemId, (elapsed) => {
        log('Step 6/7: AutoCAD processing...', `${elapsed}s elapsed`)
      })

      // Step 7: Download DWG
      log('Step 7/7: Downloading processed DWG...')
      const dwgBuffer = await this.downloadDwg(workItemResult.outputUrl)
      log('Step 7/7: DWG downloaded', `${(dwgBuffer.length / 1024).toFixed(0)} KB`)

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log('='.repeat(60))
      console.log(`[Planner DA] ✓ PROCESSING COMPLETE in ${totalTime}s`)
      console.log(`[Planner DA] Output size: ${(dwgBuffer.length / 1024).toFixed(0)} KB`)
      console.log('='.repeat(60) + '\n')

      return {
        success: true,
        dwgBuffer,
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
      // Cleanup: delete activity (bucket auto-expires after 24h)
      try {
        await this.deleteActivity()
        log('Cleanup complete')
      } catch (e) {
        console.warn('Activity cleanup warning:', e)
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
   * Upload template, user DWG, and script to OSS bucket
   */
  private async uploadFiles(
    bucketName: string,
    templateBuffer: Buffer,
    userDwgBuffer: Buffer
  ): Promise<{
    templateUrl: string
    inputUrl: string
    scriptUrl: string
  }> {
    // Generate import script
    const scriptContent = this.generateImportScript()

    // Upload all files in parallel
    const [templateResult, inputResult, scriptResult] = await Promise.all([
      this.ossService.uploadBuffer(bucketName, 'foss.dwt', templateBuffer),
      this.ossService.uploadBuffer(bucketName, 'input.dwg', userDwgBuffer),
      this.ossService.uploadBuffer(bucketName, 'import.scr', Buffer.from(scriptContent, 'utf-8')),
    ])

    return {
      templateUrl: templateResult.downloadUrl,
      inputUrl: inputResult.downloadUrl,
      scriptUrl: scriptResult.downloadUrl,
    }
  }

  /**
   * Generate the import script
   *
   * @remarks
   * Script runs after FOSS.dwt is loaded via /i switch:
   * 1. Set headless mode
   * 2. INSERT user's DWG at origin
   * 3. EXPLODE to merge layers
   * 4. ZOOM extents
   * 5. SAVEAS and QUIT
   */
  private generateImportScript(): string {
    return `; Floor Plan Import Script
; FOSS.dwt template sets all units, layers, and drawing settings

; Headless mode
(setvar "cmdecho" 0)
(setvar "filedia" 0)

; Insert user's DWG at origin
(command "-INSERT" "input" "0,0" "1" "" "0")

; Explode block to merge layers into current drawing
(command "EXPLODE" (entlast) "")

; Zoom to extents
(command "ZOOM" "E")

; Save and quit
(command "SAVEAS" "2018" "output.dwg")
QUIT
`
  }

  /**
   * Submit a WorkItem to Design Automation
   */
  private async submitWorkItem(
    bucketName: string,
    uploadResults: { templateUrl: string; inputUrl: string; scriptUrl: string },
    outputFileName: string
  ): Promise<{ workItemId: string; outputUrl: string }> {
    const accessToken = await this.authService.getAccessToken()

    // Generate output URL with readwrite access
    const outputUrl = await this.ossService.generateOutputUrl(bucketName, `${outputFileName}.dwg`)

    const activityId = `${APS_CONFIG.nickname}.${PLANNER_ACTIVITY_NAME}+production`

    const workItemSpec = {
      activityId,
      arguments: {
        template: { url: uploadResults.templateUrl, verb: 'get' },
        input: { url: uploadResults.inputUrl, verb: 'get' },
        script: { url: uploadResults.scriptUrl, verb: 'get' },
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

    return {
      workItemId: data.id,
      outputUrl,
    }
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

  /**
   * Download a DWG file from a signed URL
   */
  private async downloadDwg(dwgUrl: string): Promise<Buffer> {
    const response = await fetch(dwgUrl)

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('DWG download URL has expired')
      }
      throw new Error(`Failed to download DWG: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
}
