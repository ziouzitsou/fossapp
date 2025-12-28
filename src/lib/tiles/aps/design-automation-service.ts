/**
 * APS Design Automation Service
 * Main orchestrator for tile processing using Autodesk Platform Services
 *
 * Handles:
 * - Activity creation/deletion
 * - WorkItem submission and monitoring
 * - DWG generation workflow
 */

import { APS_CONFIG, DA_BASE_URL } from './config'
import { APSAuthService } from './auth-service'
import { OSSService } from './oss-service'
import type { ProcessingLog, FileUploadResult, WorkItemResult, TileProcessingResult } from './types'

export class APSDesignAutomationService {
  private authService = new APSAuthService()
  private ossService = new OSSService(this.authService)
  private processingLogs: ProcessingLog[] = []

  /**
   * Add log entry
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
   * Create Activity dynamically with exact number of image parameters
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
   * Delete Activity and all its aliases/versions
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
   * Process a tile with script and images
   * Creates activity dynamically and cleans up all APS resources after completion
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
   * Upload script and images to OSS
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
   * Submit WorkItem to Design Automation
   * Uses custom fossapp activity for tile processing
   * Returns workItemId and outputUrl for later download
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
   * Monitor WorkItem until completion (success or failure)
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
   * Download DWG file from URL
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
   * Test authentication
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
   * Process tile with progress callback for SSE streaming
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
   * Monitor WorkItem with progress callback
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
