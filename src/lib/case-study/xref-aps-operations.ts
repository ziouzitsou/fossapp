/**
 * XREF APS Operations
 *
 * APS Design Automation operations for XREF generation:
 * - Activity creation and management
 * - WorkItem submission and monitoring
 * - OSS file operations
 *
 * @module case-study/xref-aps-operations
 */

import { APS_CONFIG, DA_BASE_URL } from './xref-config'
import { XrefAuthService } from './xref-auth'
import type { SymbolInfo, WorkItemUploadResult, ProgressCallback } from './xref-types'

/**
 * APS Operations service for Design Automation.
 * Handles Activity, WorkItem, and OSS operations.
 */
export class XrefApsOperations {
  constructor(private authService: XrefAuthService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIVITY MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create dynamic Activity with floor plan input and N symbol inputs.
   *
   * @param symbols - Symbol info for creating input parameters
   */
  async createDynamicActivity(symbols: SymbolInfo[]): Promise<void> {
    const accessToken = await this.authService.getAccessToken()
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    // Build symbol parameters - localName is the Google Drive path (the "lie")
    const symbolParams: Record<string, object> = {}
    symbols.forEach((symbol, index) => {
      symbolParams[`symbol_${index}`] = {
        verb: 'get',
        description: `Symbol ${symbol.fossPid}`,
        required: false,
        localName: this.getFilenameFromPath(symbol.localPath),
      }
    })

    // Add placeholder symbol for products without DWGs
    symbolParams['symbol_placeholder'] = {
      verb: 'get',
      description: 'Placeholder symbol for missing DWGs',
      required: false,
      localName: 'PLACEHOLDER-SYMBOL.dwg',
    }

    const activitySpec = {
      id: APS_CONFIG.activityName,
      engine: APS_CONFIG.engineVersion,
      commandLine: [`$(engine.path)\\accoreconsole.exe /i "$(args[inputDwg].path)" /s "$(args[script].path)"`],
      parameters: {
        inputDwg: {
          verb: 'get',
          description: 'Floor plan DWG to process',
          required: true,
          localName: 'input.dwg',
        },
        script: {
          verb: 'get',
          description: 'AutoLISP script with XREF commands',
          required: true,
          localName: 'script.scr',
        },
        output: {
          verb: 'put',
          description: 'Generated DWG with XREFs',
          required: true,
          localName: 'output.dwg',
        },
        ...symbolParams,
      },
      description: `XREF generation activity with ${symbols.length} symbols`,
    }

    // Create Activity (delete if exists)
    const createResponse = await fetch(`${DA_BASE_URL}/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify(activitySpec),
    })

    if (createResponse.status === 409) {
      await this.deleteActivity()
      const retryResponse = await fetch(`${DA_BASE_URL}/activities`, {
        method: 'POST',
        headers,
        body: JSON.stringify(activitySpec),
      })
      if (!retryResponse.ok) {
        throw new Error(`Failed to create activity: ${await retryResponse.text()}`)
      }
    } else if (!createResponse.ok) {
      throw new Error(`Failed to create activity: ${await createResponse.text()}`)
    }

    // Create production alias
    await fetch(`${DA_BASE_URL}/activities/${encodeURIComponent(APS_CONFIG.activityName)}/aliases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'production', version: 1 }),
    })
  }

  /**
   * Delete Activity (cleanup)
   */
  async deleteActivity(): Promise<void> {
    try {
      const accessToken = await this.authService.getAccessToken()
      await fetch(`${DA_BASE_URL}/activities/${encodeURIComponent(APS_CONFIG.activityName)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    } catch {
      // Ignore cleanup errors
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OSS OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get signed URL for an existing OSS object by URN.
   *
   * @param urn - Base64-encoded URN
   * @returns Signed download URL
   */
  async getSignedUrlForUrn(urn: string): Promise<string> {
    console.log('[XREF] Getting signed URL for URN:', urn.substring(0, 50) + '...')
    const accessToken = await this.authService.getAccessToken()

    // Decode URN to get bucket and object key
    const decoded = Buffer.from(urn, 'base64').toString('utf-8')
    const match = decoded.match(/urn:adsk\.objects:os\.object:([^/]+)\/(.+)/)

    if (!match) {
      throw new Error(`Invalid URN format: ${decoded}`)
    }

    const [, bucketKey, objectKey] = match
    console.log('[XREF] Decoded URN - bucket:', bucketKey, 'object:', objectKey)

    const response = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signed`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ minutesExpiration: 60 }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[XREF] Failed to get signed URL:', response.status, errorText)
      throw new Error(`Failed to get floor plan URL: ${response.statusText}`)
    }

    const { signedUrl } = (await response.json()) as { signedUrl: string }
    console.log('[XREF] Got signed URL for floor plan')
    return signedUrl
  }

  /**
   * Prepare files for WorkItem: upload script, get symbol URLs from Supabase.
   * Floor plan URL is passed directly (already in OSS).
   *
   * @param bucketName - Project's OSS bucket
   * @param floorPlanUrl - Signed URL for floor plan
   * @param floorPlanFilename - Original floor plan filename
   * @param scriptContent - AutoLISP script content
   * @param symbols - Symbol info with Supabase URLs
   * @param outputFilename - Output DWG filename
   * @returns URLs for WorkItem submission
   */
  async uploadFilesForWorkItem(
    bucketName: string,
    floorPlanUrl: string,
    floorPlanFilename: string,
    scriptContent: string,
    symbols: SymbolInfo[],
    outputFilename: string
  ): Promise<WorkItemUploadResult> {
    const accessToken = await this.authService.getAccessToken()

    // Upload script to project bucket
    const scriptBuffer = Buffer.from(scriptContent, 'utf-8')
    const scriptUrl = await this.uploadToOss(bucketName, 'script.scr', scriptBuffer, accessToken)

    // Generate output URN (will use auth headers in WorkItem)
    const outputUrl = this.generateOutputUrn(bucketName, outputFilename)

    // Symbol URLs - use Supabase URLs directly (APS downloads from Supabase)
    const symbolUrls = new Map<string, string>()
    for (const symbol of symbols) {
      if (symbol.supabaseUrl) {
        symbolUrls.set(symbol.fossPid, symbol.supabaseUrl)
      }
    }

    // Add placeholder symbol URL for products without DWGs
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      const placeholderUrl = `${supabaseUrl}/storage/v1/object/public/product-symbols/PLACEHOLDER/PLACEHOLDER-SYMBOL.dwg`
      symbolUrls.set('PLACEHOLDER', placeholderUrl)
    }

    return { floorPlanUrl, scriptUrl, outputUrl, symbolUrls }
  }

  /**
   * Upload a buffer to OSS via Direct-to-S3.
   *
   * @param bucketName - Target bucket
   * @param filename - Object filename
   * @param buffer - File content
   * @param accessToken - APS access token
   * @returns Signed download URL
   */
  private async uploadToOss(
    bucketName: string,
    filename: string,
    buffer: Buffer,
    accessToken: string
  ): Promise<string> {
    // Get signed upload URL
    const signedUrlResponse = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects/${encodeURIComponent(filename)}/signeds3upload?parts=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!signedUrlResponse.ok) {
      throw new Error(`Failed to get upload URL: ${signedUrlResponse.statusText}`)
    }

    const { uploadKey, urls } = (await signedUrlResponse.json()) as { uploadKey: string; urls: string[] }

    // Upload to S3
    const s3Response = await fetch(urls[0], {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(buffer),
    })

    if (!s3Response.ok) {
      throw new Error(`S3 upload failed: ${s3Response.statusText}`)
    }

    const etag = s3Response.headers.get('etag') || ''

    // Complete upload
    await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects/${encodeURIComponent(filename)}/signeds3upload`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadKey, parts: [{ partNumber: 1, etag }] }),
      }
    )

    // Generate signed download URL
    const downloadResponse = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects/${encodeURIComponent(filename)}/signed`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutesExpiration: 60 }),
      }
    )

    const { signedUrl } = (await downloadResponse.json()) as { signedUrl: string }
    return signedUrl
  }

  /**
   * Delete output DWG from OSS bucket after successful Google Drive upload.
   *
   * @param bucketName - Bucket name
   * @param filename - File to delete
   */
  async deleteOutputFromBucket(bucketName: string, filename: string): Promise<void> {
    try {
      const accessToken = await this.authService.getAccessToken()
      const response = await fetch(
        `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects/${encodeURIComponent(filename)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      if (response.ok) {
        console.log('[XREF] Deleted output from bucket:', filename)
      } else {
        console.warn('[XREF] Failed to delete output from bucket:', response.status)
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Download output DWG from project bucket using signed URL.
   *
   * @param bucketName - Bucket name
   * @param filename - File to download
   * @returns File buffer
   */
  async downloadOutputDwg(bucketName: string, filename: string): Promise<Buffer> {
    const accessToken = await this.authService.getAccessToken()

    const signedResponse = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects/${encodeURIComponent(filename)}/signed`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ minutesExpiration: 60 }),
      }
    )

    if (!signedResponse.ok) {
      const errorText = await signedResponse.text()
      console.error('[XREF] Failed to get output download URL:', signedResponse.status, errorText)
      throw new Error(`Failed to get output download URL: ${signedResponse.statusText}`)
    }

    const { signedUrl } = (await signedResponse.json()) as { signedUrl: string }

    const response = await fetch(signedUrl)
    if (!response.ok) {
      throw new Error(`Failed to download output DWG: ${response.statusText}`)
    }

    return Buffer.from(await response.arrayBuffer())
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKITEM OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Submit WorkItem to run the Activity.
   *
   * @param uploadResult - URLs from file upload
   * @param symbols - Symbol info for arguments
   * @param outputFilename - Output file name
   * @returns WorkItem ID
   */
  async submitWorkItem(
    uploadResult: WorkItemUploadResult,
    symbols: SymbolInfo[],
    outputFilename: string
  ): Promise<string> {
    const accessToken = await this.authService.getAccessToken()

    const args: Record<string, object> = {
      inputDwg: { url: uploadResult.floorPlanUrl, verb: 'get' },
      script: { url: uploadResult.scriptUrl, verb: 'get' },
      output: {
        url: uploadResult.outputUrl,
        verb: 'put',
        localName: outputFilename,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-ads-region': 'EMEA',
        },
      },
    }

    // Add symbol arguments
    symbols.forEach((symbol, index) => {
      const url = uploadResult.symbolUrls.get(symbol.fossPid)
      if (url) {
        args[`symbol_${index}`] = {
          url,
          verb: 'get',
          localName: this.getFilenameFromPath(symbol.localPath),
        }
      }
    })

    // Add placeholder for products without DWGs
    const placeholderUrl = uploadResult.symbolUrls.get('PLACEHOLDER')
    if (placeholderUrl) {
      args['symbol_placeholder'] = {
        url: placeholderUrl,
        verb: 'get',
        localName: 'PLACEHOLDER-SYMBOL.dwg',
      }
    }

    const workItemSpec = {
      activityId: `fossapp.${APS_CONFIG.activityName}+production`,
      arguments: args,
    }

    const response = await fetch(`${DA_BASE_URL}/workitems`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-force': 'true',
      },
      body: JSON.stringify(workItemSpec),
    })

    if (!response.ok) {
      throw new Error(`WorkItem submission failed: ${await response.text()}`)
    }

    const data = (await response.json()) as { id: string }
    return data.id
  }

  /**
   * Monitor WorkItem until completion.
   *
   * @param workItemId - WorkItem ID to monitor
   * @param onProgress - Progress callback
   * @returns Report on completion
   */
  async monitorWorkItem(
    workItemId: string,
    onProgress: ProgressCallback
  ): Promise<{ report?: string }> {
    const accessToken = await this.authService.getAccessToken()
    let attempts = 0
    const startTime = Date.now()

    while (attempts < APS_CONFIG.maxPollingAttempts) {
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

      if (data.status === 'pending' || data.status === 'inprogress') {
        onProgress('aps', 'Processing...', `${elapsed}s elapsed`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        attempts++
        continue
      }

      // Get report
      let report: string | undefined
      if (data.reportUrl) {
        try {
          const reportResponse = await fetch(data.reportUrl)
          report = await reportResponse.text()
        } catch {
          // Ignore
        }
      }

      if (data.status === 'success') {
        return { report }
      } else {
        let errorSnippet = 'Unknown error'
        if (report) {
          const lines = report.split('\n')
          const errorLines = lines.filter(line => {
            const lower = line.toLowerCase()
            return lower.includes('error') || lower.includes('failed') || lower.includes('invalid')
          })
          errorSnippet = errorLines.length > 0 ? errorLines.slice(-10).join('\n') : report.slice(-1000)
        }
        throw new Error(`WorkItem failed: ${data.status}\n${errorSnippet}`)
      }
    }

    throw new Error(`WorkItem timeout (${APS_CONFIG.processingTimeoutMinutes} minutes)`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate URN for output file (used with auth headers in WorkItem)
   */
  private generateOutputUrn(bucketName: string, filename: string): string {
    return `urn:adsk.objects:os.object:${bucketName}/${filename}`
  }

  /**
   * Extract filename from a full path
   */
  private getFilenameFromPath(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1]
  }
}
