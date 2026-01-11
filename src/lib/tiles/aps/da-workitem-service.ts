/**
 * DA WorkItem Service
 *
 * Handles Design Automation WorkItem operations:
 * - Submission with dynamic image arguments
 * - Status monitoring with optional progress callbacks
 *
 * @module tiles/aps/da-workitem-service
 */

import { APS_CONFIG, DA_BASE_URL } from './config'
import { APSAuthService } from './auth-service'
import { OSSService } from './oss-service'
import { DAActivityManager } from './da-activity-manager'
import type { ProcessingLog, FileUploadResult, WorkItemResult } from './types'

/**
 * Service for WorkItem operations
 */
export class DAWorkItemService {
  constructor(
    private authService: APSAuthService,
    private ossService: OSSService,
    private activityManager: DAActivityManager,
    private addLog: (step: string, status: ProcessingLog['status'], details?: Record<string, unknown>) => void
  ) {}

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
  async submitWorkItem(
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
    const activityInfo = await this.activityManager.getActivityParameters()

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
  async monitorWorkItem(workItemId: string): Promise<{ report?: string }> {
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
   * Monitor a WorkItem with progress updates
   *
   * @param workItemId - WorkItem to monitor
   * @param onProgress - Callback for elapsed time updates
   * @returns AutoCAD report on completion
   * @throws Error on failure or timeout
   */
  async monitorWorkItemWithProgress(
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
