/**
 * APS Design Automation Service for Symbol Generation
 *
 * Simplified version of aps-service.ts specifically for symbol generation.
 * Handles both DWG and PNG output from AutoLISP scripts.
 *
 * Key differences from tiles:
 * - No image inputs (symbols are generated from script only)
 * - Two outputs: DWG and PNG
 * - Simpler activity definition
 */

import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager'
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication'

// Configuration
const APS_CONFIG = {
  clientId: process.env.APS_CLIENT_ID || '',
  clientSecret: process.env.APS_CLIENT_SECRET || '',
  scopes: [
    Scopes.BucketCreate,
    Scopes.BucketRead,
    Scopes.BucketDelete,
    Scopes.DataRead,
    Scopes.DataWrite,
    Scopes.DataCreate,
    Scopes.CodeAll,
  ],
  // Design Automation settings
  activityName: 'fossappSymbolAct',
  engineVersion: 'Autodesk.AutoCAD+25_1',
  processingTimeoutMinutes: 5,
  maxPollingAttempts: 150, // 5 minutes at 2-second intervals
}

const DA_BASE_URL = 'https://developer.api.autodesk.com/da/us-east/v3'

// Types
export interface SymbolProcessingResult {
  success: boolean
  dwgBuffer?: Buffer
  pngBuffer?: Buffer
  viewerUrn?: string
  workItemId: string
  workItemReport?: string
  message: string
  errors: string[]
}

// Auth Service
class APSAuthService {
  private sdkManager = SdkManagerBuilder.create().build()
  private authClient: AuthenticationClient
  private tokenCache: string | null = null
  private tokenExpiry: number | null = null

  constructor() {
    this.authClient = new AuthenticationClient({ sdkManager: this.sdkManager })
  }

  async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.tokenCache
    }

    if (!APS_CONFIG.clientId || !APS_CONFIG.clientSecret) {
      throw new Error('APS credentials not configured')
    }

    const credentials = await this.authClient.getTwoLeggedToken(
      APS_CONFIG.clientId,
      APS_CONFIG.clientSecret,
      APS_CONFIG.scopes
    )

    this.tokenCache = credentials.access_token
    this.tokenExpiry = Date.now() + (credentials.expires_in - 300) * 1000

    return this.tokenCache
  }
}

// Symbol APS Service
class SymbolAPSService {
  private authService = new APSAuthService()

  /**
   * Create temporary bucket
   */
  private async createTempBucket(): Promise<string> {
    const accessToken = await this.authService.getAccessToken()
    const bucketName = `symbol-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    const response = await fetch('https://developer.api.autodesk.com/oss/v2/buckets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'EMEA',
      },
      body: JSON.stringify({
        bucketKey: bucketName,
        policyKey: 'transient',
      }),
    })

    if (!response.ok && response.status !== 409) {
      const errorText = await response.text()
      throw new Error(`Bucket creation failed: ${errorText}`)
    }

    return bucketName
  }

  /**
   * Delete a bucket (cleanup)
   */
  private async deleteBucket(bucketName: string): Promise<void> {
    try {
      const accessToken = await this.authService.getAccessToken()
      await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Upload buffer to OSS using Direct-to-S3
   */
  private async uploadBuffer(bucketName: string, fileName: string, buffer: Buffer): Promise<string> {
    const accessToken = await this.authService.getAccessToken()

    // Get signed upload URL
    const signedUrlResponse = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects/${encodeURIComponent(fileName)}/signeds3upload?parts=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!signedUrlResponse.ok) {
      throw new Error(`Failed to get signed upload URL: ${signedUrlResponse.statusText}`)
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
    const completeResponse = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects/${encodeURIComponent(fileName)}/signeds3upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uploadKey, parts: [{ partNumber: 1, etag }] }),
      }
    )

    if (!completeResponse.ok) {
      throw new Error(`Failed to complete upload: ${completeResponse.statusText}`)
    }

    // Get signed download URL
    return this.generateSignedUrl(bucketName, fileName)
  }

  /**
   * Generate signed URL for download
   */
  private async generateSignedUrl(bucketKey: string, fileName: string): Promise<string> {
    const accessToken = await this.authService.getAccessToken()

    const response = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(fileName)}/signed`,
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
      throw new Error(`Failed to generate signed URL: ${response.statusText}`)
    }

    const data = (await response.json()) as { signedUrl: string }
    return data.signedUrl
  }

  /**
   * Generate signed URL for output (readwrite for PUT and GET)
   */
  private async generateOutputUrl(bucketKey: string, fileName: string): Promise<string> {
    const accessToken = await this.authService.getAccessToken()

    const response = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(fileName)}/signed?access=readwrite`,
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
      throw new Error(`Failed to generate output URL: ${response.statusText}`)
    }

    const data = (await response.json()) as { signedUrl: string }
    return data.signedUrl
  }

  /**
   * Create Symbol activity with DWG and PNG outputs
   */
  private async createSymbolActivity(): Promise<void> {
    const accessToken = await this.authService.getAccessToken()
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    const activitySpec = {
      id: APS_CONFIG.activityName,
      engine: APS_CONFIG.engineVersion,
      commandLine: [`$(engine.path)\\accoreconsole.exe /s "$(args[script].path)"`],
      parameters: {
        script: {
          verb: 'get',
          description: 'AutoLISP script file',
          required: true,
          localName: 'script.scr',
        },
        dwgOutput: {
          verb: 'put',
          description: 'Output DWG file',
          required: true,
          localName: 'Symbol.dwg',
        },
        pngOutput: {
          verb: 'put',
          description: 'Output PNG file',
          required: false,
          localName: 'Symbol.png',
        },
      },
      description: 'Symbol generation activity with DWG and PNG output',
    }

    // Try to create activity
    const createResponse = await fetch(`${DA_BASE_URL}/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify(activitySpec),
    })

    if (!createResponse.ok && createResponse.status !== 409) {
      const errorText = await createResponse.text()
      throw new Error(`Failed to create activity: ${errorText}`)
    }

    // If exists (409), delete and recreate
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
      `${DA_BASE_URL}/activities/${encodeURIComponent(APS_CONFIG.activityName)}/aliases`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: 'production', version: 1 }),
      }
    )

    if (!aliasResponse.ok && aliasResponse.status !== 409) {
      console.warn(`Alias creation warning: ${await aliasResponse.text()}`)
    }
  }

  /**
   * Delete activity
   */
  private async deleteActivity(): Promise<void> {
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

  /**
   * Process symbol script and generate DWG + PNG
   */
  async processSymbol(
    scriptContent: string,
    fossPid: string,
    onProgress: (step: string, detail?: string) => void
  ): Promise<SymbolProcessingResult> {
    const errors: string[] = []
    let bucketName: string | null = null

    try {
      onProgress('Authenticating with APS...')
      await this.authService.getAccessToken()

      onProgress('Creating activity...')
      await this.createSymbolActivity()

      onProgress('Creating temporary bucket...')
      bucketName = await this.createTempBucket()

      onProgress('Uploading script...')
      const scriptBuffer = Buffer.from(scriptContent, 'utf-8')
      const scriptUrl = await this.uploadBuffer(bucketName, 'script.scr', scriptBuffer)

      // Generate output URLs for DWG and PNG
      const dwgOutputUrl = await this.generateOutputUrl(bucketName, 'Symbol.dwg')
      const pngOutputUrl = await this.generateOutputUrl(bucketName, 'Symbol.png')

      onProgress('Submitting WorkItem...')
      const accessToken = await this.authService.getAccessToken()

      const workItemSpec = {
        activityId: `fossapp.${APS_CONFIG.activityName}+production`,
        arguments: {
          script: { url: scriptUrl, verb: 'get' },
          dwgOutput: { url: dwgOutputUrl, verb: 'put', localName: 'Symbol.dwg' },
          pngOutput: { url: pngOutputUrl, verb: 'put', localName: 'Symbol.png' },
        },
      }

      const workItemResponse = await fetch(`${DA_BASE_URL}/workitems`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workItemSpec),
      })

      if (!workItemResponse.ok) {
        const errorText = await workItemResponse.text()
        throw new Error(`WorkItem submission failed: ${errorText}`)
      }

      const workItemData = (await workItemResponse.json()) as { id: string }
      const workItemId = workItemData.id

      onProgress('Waiting for AutoCAD processing...', 'this may take 15-30s')

      // Monitor WorkItem
      const { report } = await this.monitorWorkItem(workItemId, onProgress)

      // Download DWG output
      onProgress('Downloading DWG file...')
      let dwgBuffer: Buffer | undefined
      try {
        const dwgResponse = await fetch(dwgOutputUrl)
        if (dwgResponse.ok) {
          dwgBuffer = Buffer.from(await dwgResponse.arrayBuffer())
          onProgress('DWG downloaded', `${(dwgBuffer.length / 1024).toFixed(0)} KB`)
        }
      } catch (e) {
        console.warn('DWG download warning:', e)
      }

      // Download PNG output (optional)
      onProgress('Downloading PNG file...')
      let pngBuffer: Buffer | undefined
      try {
        const pngResponse = await fetch(pngOutputUrl)
        if (pngResponse.ok) {
          pngBuffer = Buffer.from(await pngResponse.arrayBuffer())
          onProgress('PNG downloaded', `${(pngBuffer.length / 1024).toFixed(0)} KB`)
        }
      } catch (e) {
        console.warn('PNG download warning:', e)
      }

      // Prepare for viewer if DWG available
      let viewerUrn: string | undefined
      if (dwgBuffer) {
        try {
          onProgress('Preparing for viewer...')
          const { prepareForViewing } = await import('../tiles/aps-viewer')
          const result = await prepareForViewing(`${fossPid}_Symbol.dwg`, dwgBuffer, [])
          viewerUrn = result.urn
          onProgress('Viewer ready')
        } catch (e) {
          console.warn('Viewer preparation warning:', e)
        }
      }

      if (!dwgBuffer) {
        throw new Error('DWG generation failed - no output file')
      }

      return {
        success: true,
        dwgBuffer,
        pngBuffer,
        viewerUrn,
        workItemId,
        workItemReport: report,
        message: 'Symbol generated successfully',
        errors,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(errorMessage)

      return {
        success: false,
        workItemId: '',
        message: `Symbol generation failed: ${errorMessage}`,
        errors,
      }
    } finally {
      // Cleanup: delete activity and transient bucket
      try {
        await this.deleteActivity()
        if (bucketName) {
          await this.deleteBucket(bucketName)
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Monitor WorkItem until completion
   */
  private async monitorWorkItem(
    workItemId: string,
    onProgress: (step: string, detail?: string) => void
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
        onProgress('AutoCAD processing...', `${elapsed}s elapsed`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
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
        // Log full report for debugging
        if (report) {
          console.error('[symbol-aps] Full APS report:\n', report)
        }

        // Extract meaningful error lines from the report
        let errorSnippet = 'No report'
        if (report) {
          const lines = report.split('\n')
          const errorLines = lines.filter(line => {
            const lower = line.toLowerCase()
            return (
              lower.includes('error') ||
              lower.includes('invalid') ||
              lower.includes('unknown') ||
              lower.includes('nil') ||
              lower.includes('bad argument') ||
              lower.includes('exception') ||
              lower.includes('failed') ||
              lower.includes('; expected') ||
              lower.includes('command:') // AutoCAD command echoes
            )
          })

          if (errorLines.length > 0) {
            errorSnippet = errorLines.slice(-15).join('\n')
          } else {
            // If no error lines found, show last 1500 chars (usually contains the error)
            errorSnippet = report.slice(-1500)
          }
        }

        throw new Error(`WorkItem failed: ${data.status}. Report:\n${errorSnippet}`)
      }
    }

    throw new Error(`WorkItem timeout (${APS_CONFIG.processingTimeoutMinutes} minutes)`)
  }
}

// Export singleton
export const symbolApsService = new SymbolAPSService()
