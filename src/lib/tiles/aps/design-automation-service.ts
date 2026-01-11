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

import { APSAuthService } from './auth-service'
import { OSSService } from './oss-service'
import { DAActivityManager } from './da-activity-manager'
import { DAWorkItemService } from './da-workitem-service'
import type { ProcessingLog, FileUploadResult, TileProcessingResult } from './types'

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
  private activityManager = new DAActivityManager(this.authService)
  private processingLogs: ProcessingLog[] = []

  /**
   * Add a log entry to the processing logs
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
   * Process a tile and generate a DWG file
   *
   * @remarks
   * Main entry point for tile processing without progress callback.
   * Use `processTileWithProgress` for SSE streaming support.
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

    // Create WorkItem service with logging callback
    const workItemService = new DAWorkItemService(
      this.authService,
      this.ossService,
      this.activityManager,
      this.addLog.bind(this)
    )

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
      await this.activityManager.createDynamicActivity(imageBuffers.length)
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

      // Step 5: Submit WorkItem
      logStep('Step 5/7: Submitting WorkItem...')
      this.addLog('workitem_submission', 'started')
      const workItemResult = await workItemService.submitWorkItem(bucketName, uploadResults, tileName)
      this.addLog('workitem_submission', 'completed', { workItemId: workItemResult.workItemId })
      logStep('Step 5/7: WorkItem submitted', workItemResult.workItemId)

      // Step 6: Monitor WorkItem completion
      logStep('Step 6/7: Waiting for APS processing...', 'this may take 15-30s')
      this.addLog('workitem_monitoring', 'started')
      const dwgResult = await workItemService.monitorWorkItem(workItemResult.workItemId)
      logStep('Step 6/7: APS processing complete')

      // Step 7: Download DWG
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
        await this.activityManager.deleteActivity()
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

    // Create WorkItem service with logging callback
    const workItemService = new DAWorkItemService(
      this.authService,
      this.ossService,
      this.activityManager,
      this.addLog.bind(this)
    )

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
      await this.activityManager.createDynamicActivity(imageBuffers.length)
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
      const workItemResult = await workItemService.submitWorkItem(bucketName, uploadResults, tileName)
      this.addLog('workitem_submission', 'completed', { workItemId: workItemResult.workItemId })
      logStep('WorkItem submitted', workItemResult.workItemId)

      // Step 6: Monitor WorkItem completion with progress
      logStep('Waiting for AutoCAD processing...', 'this may take 15-30s')
      this.addLog('workitem_monitoring', 'started')
      const dwgResult = await workItemService.monitorWorkItemWithProgress(workItemResult.workItemId, onProgress)
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
        await this.activityManager.deleteActivity()
        this.addLog('activity_cleanup', 'completed')
        logStep('Activity cleanup complete')
      } catch (e) {
        console.warn('Activity cleanup warning:', e)
      }
    }
  }
}
