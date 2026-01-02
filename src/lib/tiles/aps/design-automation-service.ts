/**
 * APS Design Automation Service
 *
 * Main orchestrator for tile DWG generation using Autodesk Platform Services.
 * Coordinates the full workflow:
 * 1. Authentication
 * 2. Dynamic Activity creation (with N image parameters)
 * 3. Temporary bucket creation
 * 4. File uploads (script + images)
 * 5. WorkItem submission and monitoring
 * 6. DWG download and optional viewer preparation
 * 7. Cleanup (activity deletion, bucket auto-expires)
 *
 * @remarks
 * Design Automation (DA) runs AutoCAD in the cloud. Activities define what
 * the AutoCAD engine can do (inputs, outputs, commands). WorkItems are
 * execution requests against an Activity with specific files.
 *
 * Tiles use a dynamic Activity with variable image count to support
 * different tile configurations (1-50+ images per tile).
 *
 * @module tiles/aps/design-automation-service
 * @see {@link https://aps.autodesk.com/en/docs/design-automation/v3/} DA Docs
 */

import { APS_CONFIG, DA_BASE_URL } from './config'
import { APSAuthService } from './auth-service'
import { OSSService } from './oss-service'
import type { ProcessingLog, FileUploadResult, WorkItemResult, TileProcessingResult } from './types'

/**
 * Service for processing tiles through APS Design Automation
 *
 * @remarks
 * Creates a new instance per tile processing request.
 * Manages its own auth/OSS services and processing logs.
 *
 * @example
 * ```typescript
 * const service = new APSDesignAutomationService()
 * const result = await service.processTileWithProgress(
 *   scriptContent,
 *   imageBuffers,
 *   'Tile Q321',
 *   (step, detail) => console.log(step, detail)
 * )
 * if (result.success && result.dwgBuffer) {
 *   // Save DWG to Google Drive, etc.
 * }
 * ```
 */
export class APSDesignAutomationService {
  private authService = new APSAuthService()
  private ossService = new OSSService(this.authService)
  private processingLogs: ProcessingLog[] = []

  /**
   * Add a log entry to the processing logs
   *
   * @param step - Processing step identifier
   * @param status - Current status
   * @param details - Optional additional context
   */
  private addLog(step: string, status: ProcessingLog['status'], details?: Record<string, unknown>) {
    this.processingLogs.push({
      timestamp: new Date().toISOString(),
      step,
      status,
      details,
    })
  }

  /**
   * Create a Design Automation Activity with dynamic image parameters
   *
   * @remarks
   * Activities define the "contract" for WorkItems:
   * - Engine version (AutoCAD 2025)
   * - Command line (accoreconsole.exe with script)
   * - Parameters (script input, tile output, N image inputs)
   *
   * This method creates an Activity with exactly the number of image
   * parameters needed, avoiding the "unused parameter" warnings.
   *
   * If Activity already exists (409), it's deleted and recreated.
   *
   * @param imageCount - Number of image parameters to define
   */
  private async createDynamicActivity(imageCount: number): Promise<void> {
    const accessToken = await this.authService.getAccessToken()
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    // Build image parameters dynamically
    const imageParams: Record<string, { verb: string; description: string; required: boolean; localName: string }> = {}
    for (let i = 1; i <= imageCount; i++) {
      imageParams[`image${i}`] = {
        verb: 'get',
        description: `Image ${i}`,
        required: false,
        localName: `image${i}.png`,
      }
    }

    const activitySpec = {
      id: APS_CONFIG.activityName,
      engine: APS_CONFIG.engineVersion,
      commandLine: [`$(engine.path)\\accoreconsole.exe /s "$(args[script].path)"`],
      parameters: {
        script: {
          verb: 'get',
          description: 'AutoCAD script file to execute',
          required: true,
          localName: 'script.scr',
        },
        tile: {
          verb: 'put',
          description: 'Output DWG file',
          required: true,
          localName: 'Tile.dwg',
        },
        ...imageParams,
      },
      description: `Dynamic tile activity with ${imageCount} images`,
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
    const activityData = createResponse.status === 409
      ? { version: 1 }
      : await createResponse.json() as { version: number }

    const aliasResponse = await fetch(
      `${DA_BASE_URL}/activities/${encodeURIComponent(APS_CONFIG.activityName)}/aliases`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: 'production', version: activityData.version }),
      }
    )

    // Ignore 409 (alias exists) - it's fine
    if (!aliasResponse.ok && aliasResponse.status !== 409) {
      const errorText = await aliasResponse.text()
      console.warn(`Alias creation warning: ${errorText}`)
    }
  }

  /**
   * Delete the current Activity and all its aliases/versions
   *
   * @remarks
   * Non-blocking: errors are logged but not thrown.
   * Called in cleanup phase to avoid accumulating old Activity versions.
   */
  private async deleteActivity(): Promise<void> {
    try {
      const accessToken = await this.authService.getAccessToken()
      const response = await fetch(
        `${DA_BASE_URL}/activities/${encodeURIComponent(APS_CONFIG.activityName)}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      )
      // Ignore 404 (doesn't exist) - that's fine
      if (!response.ok && response.status !== 404 && response.status !== 204) {
        console.warn(`Activity deletion warning: ${response.status}`)
      }
    } catch (error) {
      // Non-blocking - don't throw
      console.warn('Activity cleanup error:', error)
    }
  }

  /**
   * Process a tile and generate a DWG file
   *
   * @remarks
   * Main entry point for tile processing without progress callback.
   * Use `processTileWithProgress` for SSE streaming support.
   *
   * Full workflow:
   * 1. Authenticate with APS
   * 2. Create Activity with N image params
   * 3. Create transient bucket
   * 4. Upload script + images
   * 5. Submit WorkItem
   * 6. Poll for completion
   * 7. Download DWG
   * 8. Cleanup Activity (bucket auto-expires)
   *
   * @param scriptContent - AutoCAD script (.scr format)
   * @param imageBuffers - Array of images to embed in the DWG
   * @param tileName - Name for the output file (e.g., 'Tile Q321')
   * @returns Processing result with DWG buffer on success
   */
  async processTile(
    scriptContent: string,
    imageBuffers: Array<{ filename: string; buffer: Buffer }>,
    tileName: string
  ): Promise<TileProcessingResult> {
    this.processingLogs = []
    const errors: string[] = []
    let bucketName: string | null = null

    const startTime = Date.now()
    const logStep = (step: string, details?: string) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[${elapsed}s] ${step}${details ? ` - ${details}` : ''}`)
    }

    try {
      logStep('TILE PROCESSING STARTED', `${tileName} (${imageBuffers.length} images)`)
      this.addLog('tile_processing', 'started', {
        tileName,
        scriptLength: scriptContent.length,
        imageCount: imageBuffers.length,
      })

      // Step 1: Authenticate
      logStep('Step 1/7: Authenticating...')
      this.addLog('authentication', 'started')
      await this.authService.getAccessToken()
      this.addLog('authentication', 'completed')
      logStep('Step 1/7: Authentication complete')

      // Step 2: Create Activity dynamically with exact image count
      logStep('Step 2/7: Creating activity...', `${imageBuffers.length} image params`)
      this.addLog('activity_creation', 'started', { imageCount: imageBuffers.length })
      await this.createDynamicActivity(imageBuffers.length)
      this.addLog('activity_creation', 'completed')
      logStep('Step 2/7: Activity created')

      // Step 3: Create temp bucket
      logStep('Step 3/7: Creating bucket...')
      this.addLog('bucket_creation', 'started')
      bucketName = await this.ossService.createTempBucket(tileName)
      this.addLog('bucket_creation', 'completed', { bucketName })
      logStep('Step 3/7: Bucket created', bucketName)

      // Step 4: Upload files
      logStep('Step 4/7: Uploading files...', `${1 + imageBuffers.length} files`)
      this.addLog('file_upload', 'started', { totalFiles: 1 + imageBuffers.length })
      const uploadResults = await this.uploadFiles(bucketName, scriptContent, imageBuffers)
      this.addLog('file_upload', 'completed', { filesUploaded: uploadResults.length })
      logStep('Step 4/7: Files uploaded', `${uploadResults.length} files`)

      // Step 5: Submit WorkItem (returns outputUrl for later download)
      logStep('Step 5/7: Submitting WorkItem...')
      this.addLog('workitem_submission', 'started')
      const workItemResult = await this.submitWorkItem(bucketName, uploadResults, tileName)
      this.addLog('workitem_submission', 'completed', { workItemId: workItemResult.workItemId })
      logStep('Step 5/7: WorkItem submitted', workItemResult.workItemId)

      // Step 6: Monitor WorkItem completion
      logStep('Step 6/7: Waiting for APS processing...', 'this may take 15-30s')
      this.addLog('workitem_monitoring', 'started')
      const dwgResult = await this.monitorWorkItem(workItemResult.workItemId)
      logStep('Step 6/7: APS processing complete')

      // Step 7: Download DWG using the same signed URL (supports both PUT and GET)
      logStep('Step 7/7: Downloading DWG...')
      this.addLog('dwg_download', 'started')
      const dwgBuffer = await this.downloadDwg(workItemResult.outputUrl)
      this.addLog('dwg_download', 'completed', { size: dwgBuffer.length })
      logStep('Step 7/7: DWG downloaded', `${(dwgBuffer.length / 1024).toFixed(0)} KB`)

      this.addLog('tile_processing', 'completed', { tileName })
      logStep('TILE PROCESSING COMPLETE', `${tileName}`)

      return {
        success: true,
        tileName,
        workItemId: workItemResult.workItemId,
        dwgUrl: workItemResult.outputUrl,
        dwgBuffer,
        processingLogs: this.processingLogs,
        workItemReport: dwgResult.report,
        message: 'DWG generated and downloaded successfully',
        errors,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.addLog('tile_processing', 'error', { error: errorMessage })
      errors.push(errorMessage)
      logStep('TILE PROCESSING FAILED', errorMessage)

      return {
        success: false,
        tileName,
        workItemId: '',
        dwgUrl: '',
        processingLogs: this.processingLogs,
        message: `Processing failed: ${errorMessage}`,
        errors,
      }
    } finally {
      // Always cleanup: delete bucket and activity
      logStep('Cleanup: Deleting bucket and activity...')
      this.addLog('cleanup', 'started')

      if (bucketName) {
        try {
          await this.ossService.deleteTempBucket(bucketName)
          this.addLog('bucket_cleanup', 'completed', { bucketName })
          logStep('Cleanup: Bucket deleted')
        } catch (e) {
          console.warn('Bucket cleanup warning:', e)
        }
      }

      try {
        await this.deleteActivity()
        this.addLog('activity_cleanup', 'completed')
        logStep('Cleanup: Activity deleted')
      } catch (e) {
        console.warn('Activity cleanup warning:', e)
      }

      this.addLog('cleanup', 'completed')
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[${totalTime}s] TOTAL TIME: ${totalTime}s`)
    }
  }

  /**
   * Upload script and image files to OSS bucket
   *
   * @param bucketName - Target OSS bucket
   * @param scriptContent - Script content to upload as script.scr
   * @param imageBuffers - Images to upload with their filenames
   * @returns Array of upload results with signed URLs
   */
  private async uploadFiles(
    bucketName: string,
    scriptContent: string,
    imageBuffers: Array<{ filename: string; buffer: Buffer }>
  ): Promise<FileUploadResult[]> {
    const results: FileUploadResult[] = []

    // Upload script
    const scriptBuffer = Buffer.from(scriptContent, 'utf-8')
    const scriptResult = await this.ossService.uploadBuffer(bucketName, 'script.scr', scriptBuffer)
    scriptResult.type = 'script'
    results.push(scriptResult)

    // Upload images
    for (let i = 0; i < imageBuffers.length; i++) {
      const { filename, buffer } = imageBuffers[i]
      const imageResult = await this.ossService.uploadBuffer(bucketName, filename, buffer)
      imageResult.type = 'image'
      imageResult.originalName = filename
      imageResult.index = i + 1
      results.push(imageResult)
    }

    return results
  }

  /**
   * Submit a WorkItem to Design Automation
   *
   * @remarks
   * WorkItem is an execution request against our Activity.
   * Specifies input files (script, images) and output location (DWG).
   * Returns immediately with workItemId for status polling.
   *
   * @param bucketName - OSS bucket containing input files
   * @param uploadResults - Results from uploadFiles with signed URLs
   * @param tileName - Output filename (without extension)
   * @returns WorkItem ID and output URL for monitoring/download
   */
  private async submitWorkItem(
    bucketName: string,
    uploadResults: FileUploadResult[],
    tileName: string
  ): Promise<WorkItemResult & { outputUrl: string }> {
    const accessToken = await this.authService.getAccessToken()

    // Use actual tile name from the app (e.g., "Tile Q321.dwg")
    const outputFilename = `${tileName}.dwg`

    // Generate OSS signed URL with readwrite access (supports PUT by APS and GET by us)
    const outputUrl = await this.ossService.generateOutputUrl(bucketName, outputFilename)

    // Build WorkItem spec
    const scriptFile = uploadResults.find((r) => r.type === 'script')!
    const imageFiles = uploadResults.filter((r) => r.type === 'image')

    // Use our custom activity (fossapp.fossappTileAct2+production)
    const activityId = `${APS_CONFIG.nickname}.${APS_CONFIG.activityName}+production`

    const workItemSpec: {
      activityId: string
      arguments: Record<string, { url: string; verb: string; localName?: string; headers?: Record<string, string> }>
    } = {
      activityId,
      arguments: {
        script: { url: scriptFile.downloadUrl, verb: 'get' },
        tile: { url: outputUrl, verb: 'put', localName: outputFilename },
      },
    }

    // First try to get activity parameters to use correct image param names
    const activityInfo = await this.getActivityParameters(accessToken)

    // Add image arguments based on activity parameters or fallback to generic names
    this.addImageArguments(workItemSpec, imageFiles, activityInfo)

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

    const data = (await response.json()) as { id: string; status: string }

    return {
      workItemId: data.id,
      status: data.status,
      reportUrl: null,
      outputUrl, // The signed URL for both upload and download
    }
  }

  /**
   * Get Activity parameter definitions
   */
  private async getActivityParameters(
    accessToken: string
  ): Promise<{ parameters?: Record<string, unknown> } | null> {
    try {
      const activityId = `${APS_CONFIG.nickname}.${APS_CONFIG.activityName}+production`
      const response = await fetch(`${DA_BASE_URL}/activities/${activityId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) return null
      return (await response.json()) as { parameters?: Record<string, unknown> }
    } catch {
      return null
    }
  }

  /**
   * Add image arguments to WorkItem based on Activity parameters
   * Includes localName to override the Activity's default filename
   */
  private addImageArguments(
    workItemSpec: { arguments: Record<string, { url: string; verb: string; localName?: string }> },
    imageFiles: FileUploadResult[],
    activityInfo: { parameters?: Record<string, unknown> } | null
  ): void {
    if (!activityInfo?.parameters) {
      // Fallback: generic image1, image2, etc.
      imageFiles.forEach((img) => {
        workItemSpec.arguments[`image${img.index}`] = {
          url: img.downloadUrl,
          verb: 'get',
          localName: img.originalName || `image${img.index}.png`,
        }
      })
      return
    }

    // Get image parameters from Activity (exclude script and tile)
    const imageParams = Object.keys(activityInfo.parameters).filter(
      (key) => key !== 'tile' && key !== 'script'
    )

    // Map uploaded images to Activity parameters with their original filenames
    imageFiles.forEach((img, idx) => {
      if (idx < imageParams.length) {
        workItemSpec.arguments[imageParams[idx]] = {
          url: img.downloadUrl,
          verb: 'get',
          localName: img.originalName || `image${idx + 1}.png`,
        }
      }
    })
  }

  /**
   * Monitor a WorkItem until completion
   *
   * @remarks
   * Polls DA API every 2 seconds until status is terminal (success/failed).
   * Typical processing time: 15-30 seconds.
   * Timeout after maxPollingAttempts (configured in APS_CONFIG).
   *
   * @param workItemId - WorkItem to monitor
   * @returns AutoCAD report on completion
   * @throws Error on failure or timeout
   */
  private async monitorWorkItem(workItemId: string): Promise<{ report?: string }> {
    const accessToken = await this.authService.getAccessToken()

    let attempts = 0
    const maxAttempts = APS_CONFIG.maxPollingAttempts

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

      this.addLog('workitem_status', 'info', {
        attempt: attempts + 1,
        status: data.status,
        progress: data.progress || 'N/A',
      })

      if (data.status === 'pending' || data.status === 'inprogress') {
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
        this.addLog('workitem_monitoring', 'completed', { status: 'success' })
        return { report }
      } else {
        // Include report in error for debugging
        const reportSnippet = report ? report.substring(0, 2000) : 'No report available'
        console.error('WorkItem failed. Report:', reportSnippet)
        throw new Error(`WorkItem failed with status: ${data.status}. Report: ${reportSnippet}`)
      }
    }

    throw new Error(`WorkItem processing timeout (${APS_CONFIG.processingTimeoutMinutes} minutes)`)
  }

  /**
   * Download a DWG file from a signed URL
   *
   * @param dwgUrl - Pre-signed URL to download from
   * @returns DWG file contents as Buffer
   * @throws Error if download fails or URL expired
   */
  async downloadDwg(dwgUrl: string): Promise<Buffer> {
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

  /**
   * Test APS authentication
   *
   * @remarks
   * Useful for connection diagnostics and validating credentials.
   *
   * @returns Success status and message
   */
  async testAuthentication(): Promise<{ success: boolean; message: string; expiresIn?: number }> {
    try {
      await this.authService.getAccessToken()
      return {
        success: true,
        message: 'Authentication successful',
        expiresIn: 3600,
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Authentication failed',
      }
    }
  }

  /**
   * Process a tile with real-time progress updates
   *
   * @remarks
   * Primary entry point for tile processing with SSE streaming.
   * Progress callback fires at each workflow step for live UI updates.
   *
   * Also includes viewer preparation step (SVF translation) after DWG
   * generation for immediate web preview capability.
   *
   * @param scriptContent - AutoCAD script (.scr format)
   * @param imageBuffers - Array of images to embed in the DWG
   * @param tileName - Name for the output file (e.g., 'Tile Q321')
   * @param onProgress - Callback for progress updates (step, optional detail)
   * @returns Processing result with DWG buffer and optional viewerUrn
   *
   * @example
   * ```typescript
   * const result = await service.processTileWithProgress(
   *   script,
   *   images,
   *   'Tile Q321',
   *   (step, detail) => {
   *     // Send to SSE stream
   *     res.write(`data: ${JSON.stringify({ step, detail })}\n\n`)
   *   }
   * )
   * ```
   */
  async processTileWithProgress(
    scriptContent: string,
    imageBuffers: Array<{ filename: string; buffer: Buffer }>,
    tileName: string,
    onProgress: (step: string, detail?: string) => void
  ): Promise<TileProcessingResult> {
    this.processingLogs = []
    const errors: string[] = []
    let bucketName: string | null = null

    const startTime = Date.now()
    const logStep = (step: string, details?: string) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[${elapsed}s] ${step}${details ? ` - ${details}` : ''}`)
      onProgress(step, details)
    }

    try {
      logStep('Starting APS Design Automation', `${tileName} (${imageBuffers.length} images)`)
      this.addLog('tile_processing', 'started', {
        tileName,
        scriptLength: scriptContent.length,
        imageCount: imageBuffers.length,
      })

      // Step 1: Authenticate
      logStep('Authenticating with APS...')
      this.addLog('authentication', 'started')
      await this.authService.getAccessToken()
      this.addLog('authentication', 'completed')
      logStep('Authentication complete')

      // Step 2: Create Activity dynamically with exact image count
      logStep('Creating activity...', `${imageBuffers.length} image params`)
      this.addLog('activity_creation', 'started', { imageCount: imageBuffers.length })
      await this.createDynamicActivity(imageBuffers.length)
      this.addLog('activity_creation', 'completed')
      logStep('Activity created')

      // Step 3: Create temp bucket
      logStep('Creating temporary bucket...')
      this.addLog('bucket_creation', 'started')
      bucketName = await this.ossService.createTempBucket(tileName)
      this.addLog('bucket_creation', 'completed', { bucketName })
      logStep('Bucket created', bucketName)

      // Step 4: Upload files
      logStep('Uploading files...', `${1 + imageBuffers.length} files`)
      this.addLog('file_upload', 'started', { totalFiles: 1 + imageBuffers.length })
      const uploadResults = await this.uploadFiles(bucketName, scriptContent, imageBuffers)
      this.addLog('file_upload', 'completed', { filesUploaded: uploadResults.length })
      logStep('Files uploaded', `${uploadResults.length} files`)

      // Step 5: Submit WorkItem
      logStep('Submitting WorkItem...')
      this.addLog('workitem_submission', 'started')
      const workItemResult = await this.submitWorkItem(bucketName, uploadResults, tileName)
      this.addLog('workitem_submission', 'completed', { workItemId: workItemResult.workItemId })
      logStep('WorkItem submitted', workItemResult.workItemId)

      // Step 6: Monitor WorkItem completion with progress
      logStep('Waiting for AutoCAD processing...', 'this may take 15-30s')
      this.addLog('workitem_monitoring', 'started')
      const dwgResult = await this.monitorWorkItemWithProgress(workItemResult.workItemId, onProgress)
      logStep('AutoCAD processing complete')

      // Step 7: Download DWG
      logStep('Downloading DWG file...')
      this.addLog('dwg_download', 'started')
      const dwgBuffer = await this.downloadDwg(workItemResult.outputUrl)
      this.addLog('dwg_download', 'completed', { size: dwgBuffer.length })
      logStep('DWG downloaded', `${(dwgBuffer.length / 1024).toFixed(0)} KB`)

      // Step 8: Prepare for viewer using dedicated viewer bucket
      logStep('Preparing for viewer...', `${imageBuffers.length} images`)
      this.addLog('viewer_prep', 'started')

      let viewerUrn: string | undefined
      try {
        const { prepareForViewing } = await import('../aps-viewer')

        // Convert image buffers to the format expected by prepareForViewing
        const images = imageBuffers.map(img => ({
          name: img.filename,
          buffer: img.buffer
        }))

        const dwgFilename = `${tileName}.dwg`
        const result = await prepareForViewing(dwgFilename, dwgBuffer, images)
        viewerUrn = result.urn

        this.addLog('viewer_prep', 'completed', { urn: viewerUrn })
        logStep('Viewer preparation complete', 'translation started')
      } catch (e) {
        // Non-fatal - viewer button will fall back to Google Drive download
        console.warn('Viewer preparation warning:', e)
        this.addLog('viewer_prep', 'error', { error: String(e) })
      }

      this.addLog('tile_processing', 'completed', { tileName })
      logStep('APS processing complete')

      return {
        success: true,
        tileName,
        workItemId: workItemResult.workItemId,
        dwgUrl: workItemResult.outputUrl,
        dwgBuffer,
        viewerUrn,
        processingLogs: this.processingLogs,
        workItemReport: dwgResult.report,
        message: 'DWG generated and downloaded successfully',
        errors,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.addLog('tile_processing', 'error', { error: errorMessage })
      errors.push(errorMessage)
      logStep('APS processing FAILED', errorMessage)

      return {
        success: false,
        tileName,
        workItemId: '',
        dwgUrl: '',
        processingLogs: this.processingLogs,
        message: `Processing failed: ${errorMessage}`,
        errors,
      }
    } finally {
      // Cleanup activity (bucket stays for viewer - transient = 24h auto-delete)
      try {
        await this.deleteActivity()
        this.addLog('activity_cleanup', 'completed')
        logStep('Activity cleanup complete')
      } catch (e) {
        console.warn('Activity cleanup warning:', e)
      }
    }
  }

  /**
   * Monitor a WorkItem with progress updates
   *
   * @param workItemId - WorkItem to monitor
   * @param onProgress - Callback for elapsed time updates
   * @returns AutoCAD report on completion
   * @throws Error on failure or timeout
   */
  private async monitorWorkItemWithProgress(
    workItemId: string,
    onProgress: (step: string, detail?: string) => void
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

      const elapsed = Math.round((Date.now() - startTime) / 1000)

      this.addLog('workitem_status', 'info', {
        attempt: attempts + 1,
        status: data.status,
        progress: data.progress || 'N/A',
      })

      if (data.status === 'pending' || data.status === 'inprogress') {
        onProgress(`AutoCAD processing...`, `${elapsed}s elapsed`)
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
        this.addLog('workitem_monitoring', 'completed', { status: 'success' })
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
