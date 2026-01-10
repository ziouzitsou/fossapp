/**
 * XREF Generator Service for Case Study DWG Output
 *
 * Orchestrates APS Design Automation to generate floor plan DWGs
 * with luminaire symbols attached as XREFs.
 *
 * @remarks
 * Key technique: Activity parameters define Google Drive paths as `localName`,
 * but WorkItem arguments use Supabase URLs. AutoCAD finds files by filename
 * in its working directory and stores the path we specify in XREF records.
 *
 * Workflow:
 * 1. Fetch placements and products for the area
 * 2. Download floor plan DWG from OSS
 * 3. Get symbol DWG URLs from Supabase (or use placeholder)
 * 4. Create dynamic Activity with N symbol parameters
 * 5. Upload floor plan + symbols + script to temp bucket
 * 6. Submit WorkItem
 * 7. Poll for completion
 * 8. Download output DWG
 * 9. Upload to Google Drive
 *
 * @module case-study/xref-generator-service
 */

import { supabaseServer } from '@fossapp/core/db'
import { XrefScriptGenerator, type XrefPlacement } from './xref-script-generator'
import { getGoogleDriveSymbolService } from '@/lib/symbol-generator/google-drive-symbol-service'

// ============================================================================
// CONFIGURATION
// ============================================================================

const APS_CONFIG = {
  clientId: process.env.APS_CLIENT_ID || '',
  clientSecret: process.env.APS_CLIENT_SECRET || '',
  activityName: 'fossappXrefAct',
  engineVersion: 'Autodesk.AutoCAD+25_1',
  processingTimeoutMinutes: 10,
  maxPollingAttempts: 300, // 10 min at 2-second intervals
}

const DA_BASE_URL = 'https://developer.api.autodesk.com/da/us-east/v3'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Request to generate XREF DWG
 */
export interface GenerateXrefRequest {
  /** Area revision ID containing placements */
  areaRevisionId: string
  /** Project ID for bucket naming */
  projectId: string
  /** Area code for output naming (e.g., "F1") */
  areaCode: string
  /** Revision number for output naming */
  revisionNumber: number
}

/**
 * Placement data from database
 */
interface PlacementData {
  id: string
  project_product_id: string
  product_id: string
  world_x: number
  world_y: number
  rotation: number
  mirror_x: boolean
  mirror_y: boolean
  symbol: string | null
  foss_pid?: string
}

/**
 * Symbol info for a unique product
 */
interface SymbolInfo {
  fossPid: string
  localPath: string
  supabaseUrl: string | null // null = use placeholder
  hasDwg: boolean
}

/**
 * Generation result
 */
export interface GenerateXrefResult {
  success: boolean
  outputDwgBuffer?: Buffer
  outputFilename?: string
  driveLink?: string
  missingSymbols?: string[] // foss_pids that used placeholder
  errors: string[]
}

// ============================================================================
// AUTH SERVICE
// ============================================================================

class APSAuthService {
  private tokenCache: string | null = null
  private tokenExpiry: number | null = null

  async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.tokenCache
    }

    if (!APS_CONFIG.clientId || !APS_CONFIG.clientSecret) {
      throw new Error('APS credentials not configured')
    }

    const response = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: APS_CONFIG.clientId,
        client_secret: APS_CONFIG.clientSecret,
        scope: 'bucket:create bucket:read bucket:delete data:read data:write data:create code:all',
      }),
    })

    if (!response.ok) {
      throw new Error(`APS auth failed: ${response.statusText}`)
    }

    const data = (await response.json()) as { access_token: string; expires_in: number }
    this.tokenCache = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000

    return this.tokenCache
  }
}

// ============================================================================
// XREF GENERATOR SERVICE
// ============================================================================

/**
 * Service for generating XREF-based DWG output from Case Study placements.
 *
 * @example
 * ```typescript
 * const service = new XrefGeneratorService()
 * const result = await service.generateWithProgress(
 *   { areaRevisionId: '...', projectId: '...', areaCode: 'F1', revisionNumber: 1 },
 *   (phase, message, detail) => console.log(phase, message, detail)
 * )
 * ```
 */
export class XrefGeneratorService {
  private authService = new APSAuthService()
  private scriptGenerator = new XrefScriptGenerator()

  /**
   * Generate XREF DWG with progress callbacks.
   *
   * @param request - Generation request with area/project info
   * @param onProgress - Progress callback for SSE streaming
   * @returns Generation result with DWG buffer on success
   */
  async generateWithProgress(
    request: GenerateXrefRequest,
    onProgress: (phase: string, message: string, detail?: string) => void
  ): Promise<GenerateXrefResult> {
    const errors: string[] = []
    let bucketName: string | null = null
    const missingSymbols: string[] = []

    try {
      // ─────────────────────────────────────────────────────────────────────
      // Step 1: Fetch placements and product info
      // ─────────────────────────────────────────────────────────────────────
      onProgress('init', 'Fetching placements...', `Area: ${request.areaCode}`)

      const { placements, floorPlanUrn, floorPlanFilename } = await this.fetchPlacementData(
        request.areaRevisionId
      )

      if (placements.length === 0) {
        throw new Error('No placements found for this area')
      }

      if (!floorPlanUrn) {
        throw new Error('No floor plan uploaded for this area')
      }

      onProgress('init', 'Placements loaded', `${placements.length} placements`)

      // ─────────────────────────────────────────────────────────────────────
      // Step 2: Get unique symbols and check which have DWGs
      // ─────────────────────────────────────────────────────────────────────
      onProgress('init', 'Checking symbol DWGs...')

      const symbols = await this.getSymbolInfo(placements)
      const symbolsWithDwg = symbols.filter(s => s.hasDwg)
      const symbolsWithoutDwg = symbols.filter(s => !s.hasDwg)

      if (symbolsWithoutDwg.length > 0) {
        missingSymbols.push(...symbolsWithoutDwg.map(s => s.fossPid))
        onProgress('init', 'Missing symbols detected', `${symbolsWithoutDwg.length} will use placeholder`)
      }

      // ─────────────────────────────────────────────────────────────────────
      // Step 3: Build XREF placements with paths
      // ─────────────────────────────────────────────────────────────────────
      const driveService = getGoogleDriveSymbolService()
      const xrefPlacements = this.buildXrefPlacements(placements, symbols, driveService)

      // ─────────────────────────────────────────────────────────────────────
      // Step 4: Generate AutoLISP script
      // ─────────────────────────────────────────────────────────────────────
      onProgress('script', 'Generating AutoLISP script...')

      const outputFilename = `${request.areaCode}-v${request.revisionNumber}-GENERATED.dwg`
      const scriptContent = this.scriptGenerator.generateScript(xrefPlacements, {
        outputFilename,
        areaCode: request.areaCode,
        revisionNumber: request.revisionNumber,
      })

      onProgress('script', 'Script generated', `${scriptContent.length} bytes`)

      // ─────────────────────────────────────────────────────────────────────
      // Step 5: Authenticate and create dynamic Activity
      // ─────────────────────────────────────────────────────────────────────
      onProgress('aps', 'Authenticating with APS...')
      await this.authService.getAccessToken()

      onProgress('aps', 'Creating activity...', `${symbolsWithDwg.length + 1} symbol params`)
      await this.createDynamicActivity(symbolsWithDwg)

      // ─────────────────────────────────────────────────────────────────────
      // Step 6: Create temp bucket and upload files
      // ─────────────────────────────────────────────────────────────────────
      onProgress('aps', 'Creating temp bucket...')
      bucketName = await this.createTempBucket()

      onProgress('aps', 'Downloading floor plan from OSS...')
      const floorPlanBuffer = await this.downloadFromOss(floorPlanUrn)

      onProgress('aps', 'Uploading files...', `floor plan + script + ${symbolsWithDwg.length} symbols`)
      const uploadResult = await this.uploadFiles(
        bucketName,
        floorPlanBuffer,
        floorPlanFilename || 'input.dwg',
        scriptContent,
        symbolsWithDwg
      )

      // ─────────────────────────────────────────────────────────────────────
      // Step 7: Submit and monitor WorkItem
      // ─────────────────────────────────────────────────────────────────────
      onProgress('aps', 'Submitting WorkItem...')
      const workItemId = await this.submitWorkItem(
        bucketName,
        uploadResult,
        symbolsWithDwg,
        outputFilename
      )

      onProgress('aps', 'Processing...', 'This may take 30-60 seconds')
      const { report } = await this.monitorWorkItem(workItemId, onProgress)

      // ─────────────────────────────────────────────────────────────────────
      // Step 8: Download output DWG
      // ─────────────────────────────────────────────────────────────────────
      onProgress('download', 'Downloading generated DWG...')
      const outputDwgBuffer = await this.downloadDwg(uploadResult.outputUrl)
      onProgress('download', 'DWG downloaded', `${(outputDwgBuffer.length / 1024).toFixed(0)} KB`)

      // ─────────────────────────────────────────────────────────────────────
      // Cleanup: Delete activity (bucket auto-expires)
      // ─────────────────────────────────────────────────────────────────────
      await this.deleteActivity()

      return {
        success: true,
        outputDwgBuffer,
        outputFilename,
        missingSymbols: missingSymbols.length > 0 ? missingSymbols : undefined,
        errors,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(errorMessage)

      // Cleanup on error
      await this.deleteActivity()

      return {
        success: false,
        missingSymbols: missingSymbols.length > 0 ? missingSymbols : undefined,
        errors,
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Data fetching
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch placements with product info from database
   */
  private async fetchPlacementData(areaRevisionId: string): Promise<{
    placements: PlacementData[]
    floorPlanUrn: string | null
    floorPlanFilename: string | null
  }> {
    // Get floor plan info from area revision
    const { data: revision, error: revError } = await supabaseServer
      .schema('projects')
      .from('project_area_revisions')
      .select('floor_plan_urn, floor_plan_filename')
      .eq('id', areaRevisionId)
      .single()

    if (revError) {
      throw new Error(`Failed to fetch area revision: ${revError.message}`)
    }

    // Get placements with product foss_pid
    const { data: placementsRaw, error: placementsError } = await supabaseServer
      .schema('projects')
      .from('planner_placements')
      .select(`
        id,
        project_product_id,
        product_id,
        world_x,
        world_y,
        rotation,
        mirror_x,
        mirror_y,
        symbol,
        project_products!inner (
          product_id
        )
      `)
      .eq('area_version_id', areaRevisionId)

    if (placementsError) {
      throw new Error(`Failed to fetch placements: ${placementsError.message}`)
    }

    // Get product foss_pids
    const productIds = [...new Set(placementsRaw?.map(p => p.product_id) || [])]
    const { data: products, error: productsError } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('product_id, foss_pid')
      .in('product_id', productIds)

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }

    const productMap = new Map(products?.map(p => [p.product_id, p.foss_pid]) || [])

    // Map placements with foss_pid
    const placements: PlacementData[] = (placementsRaw || []).map(p => ({
      id: p.id,
      project_product_id: p.project_product_id,
      product_id: p.product_id,
      world_x: Number(p.world_x),
      world_y: Number(p.world_y),
      rotation: Number(p.rotation) || 0,
      mirror_x: Boolean(p.mirror_x),
      mirror_y: Boolean(p.mirror_y),
      symbol: p.symbol,
      foss_pid: productMap.get(p.product_id),
    }))

    return {
      placements,
      floorPlanUrn: revision?.floor_plan_urn || null,
      floorPlanFilename: revision?.floor_plan_filename || null,
    }
  }

  /**
   * Get symbol info for unique products, checking which have DWGs
   */
  private async getSymbolInfo(placements: PlacementData[]): Promise<SymbolInfo[]> {
    // Get unique foss_pids
    const uniqueFossPids = [...new Set(placements.map(p => p.foss_pid).filter(Boolean))] as string[]

    // Check which have DWG files in Supabase
    const { data: symbols, error } = await supabaseServer
      .schema('items')
      .from('product_symbols')
      .select('foss_pid, dwg_path')
      .in('foss_pid', uniqueFossPids)

    if (error) {
      console.warn('Failed to fetch symbol info:', error)
    }

    const symbolMap = new Map((symbols || []).map(s => [s.foss_pid, s.dwg_path]))

    const driveService = getGoogleDriveSymbolService()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    return uniqueFossPids.map(fossPid => {
      const dwgPath = symbolMap.get(fossPid)
      const hasDwg = Boolean(dwgPath)

      return {
        fossPid,
        localPath: driveService.getSymbolLocalPath(fossPid),
        supabaseUrl: hasDwg && supabaseUrl
          ? `${supabaseUrl}/storage/v1/object/public/product-symbols/${dwgPath}`
          : null,
        hasDwg,
      }
    })
  }

  /**
   * Build XREF placement data for script generation
   */
  private buildXrefPlacements(
    placements: PlacementData[],
    symbols: SymbolInfo[],
    driveService: ReturnType<typeof getGoogleDriveSymbolService>
  ): XrefPlacement[] {
    const symbolMap = new Map(symbols.map(s => [s.fossPid, s]))
    const placeholderPath = driveService.getSymbolLocalPath('PLACEHOLDER')

    return placements
      .filter(p => p.foss_pid) // Only placements with products
      .map(p => {
        const symbolInfo = symbolMap.get(p.foss_pid!)
        const localPath = symbolInfo?.hasDwg
          ? symbolInfo.localPath
          : placeholderPath

        return {
          fossPid: p.foss_pid!,
          localPath,
          worldX: p.world_x,
          worldY: p.world_y,
          rotation: p.rotation,
          mirrorX: p.mirror_x,
          mirrorY: p.mirror_y,
          symbol: p.symbol || undefined,
        }
      })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: APS Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create dynamic Activity with floor plan input and N symbol inputs
   */
  private async createDynamicActivity(symbols: SymbolInfo[]): Promise<void> {
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
        localName: this.getFilenameFromPath(symbol.localPath), // Just filename, not full path
      }
    })

    // Also add placeholder symbol if any symbols are missing
    symbolParams['symbol_placeholder'] = {
      verb: 'get',
      description: 'Placeholder symbol for missing DWGs',
      required: false,
      localName: 'PLACEHOLDER-SYMBOL.dwg',
    }

    const activitySpec = {
      id: APS_CONFIG.activityName,
      engine: APS_CONFIG.engineVersion,
      // Open input DWG, then run script
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
   * Create temporary bucket for file uploads
   */
  private async createTempBucket(): Promise<string> {
    const accessToken = await this.authService.getAccessToken()
    const bucketName = `xref-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    const response = await fetch('https://developer.api.autodesk.com/oss/v2/buckets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'EMEA',
      },
      body: JSON.stringify({
        bucketKey: bucketName,
        policyKey: 'transient', // Auto-delete after 24 hours
      }),
    })

    if (!response.ok && response.status !== 409) {
      throw new Error(`Bucket creation failed: ${await response.text()}`)
    }

    return bucketName
  }

  /**
   * Download floor plan from OSS using URN
   */
  private async downloadFromOss(urn: string): Promise<Buffer> {
    const accessToken = await this.authService.getAccessToken()

    // Decode URN to get bucket and object key
    // URN format: urn:adsk.objects:os.object:{bucketKey}/{objectKey} (base64 encoded)
    const decoded = Buffer.from(urn, 'base64').toString('utf-8')
    const match = decoded.match(/urn:adsk\.objects:os\.object:([^/]+)\/(.+)/)

    if (!match) {
      throw new Error(`Invalid URN format: ${decoded}`)
    }

    const [, bucketKey, objectKey] = match

    // Get signed download URL
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
      throw new Error(`Failed to get floor plan download URL: ${response.statusText}`)
    }

    const { signedUrl } = (await response.json()) as { signedUrl: string }

    // Download the file
    const downloadResponse = await fetch(signedUrl)
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download floor plan: ${downloadResponse.statusText}`)
    }

    return Buffer.from(await downloadResponse.arrayBuffer())
  }

  /**
   * Upload all files to temp bucket
   */
  private async uploadFiles(
    bucketName: string,
    floorPlanBuffer: Buffer,
    floorPlanFilename: string,
    scriptContent: string,
    symbols: SymbolInfo[]
  ): Promise<{
    floorPlanUrl: string
    scriptUrl: string
    outputUrl: string
    symbolUrls: Map<string, string>
  }> {
    const accessToken = await this.authService.getAccessToken()

    // Upload floor plan
    const floorPlanUrl = await this.uploadToOss(bucketName, 'input.dwg', floorPlanBuffer, accessToken)

    // Upload script
    const scriptBuffer = Buffer.from(scriptContent, 'utf-8')
    const scriptUrl = await this.uploadToOss(bucketName, 'script.scr', scriptBuffer, accessToken)

    // Generate output URL
    const outputUrl = await this.generateOutputUrl(bucketName, 'output.dwg', accessToken)

    // Download and upload symbol DWGs from Supabase
    const symbolUrls = new Map<string, string>()
    for (const symbol of symbols) {
      if (symbol.supabaseUrl) {
        try {
          // Download from Supabase
          const symbolResponse = await fetch(symbol.supabaseUrl)
          if (!symbolResponse.ok) {
            console.warn(`Failed to download symbol ${symbol.fossPid}: ${symbolResponse.statusText}`)
            continue
          }
          const symbolBuffer = Buffer.from(await symbolResponse.arrayBuffer())

          // Upload to temp bucket with filename that matches localName
          const filename = this.getFilenameFromPath(symbol.localPath)
          const url = await this.uploadToOss(bucketName, filename, symbolBuffer, accessToken)
          symbolUrls.set(symbol.fossPid, url)
        } catch (err) {
          console.warn(`Error uploading symbol ${symbol.fossPid}:`, err)
        }
      }
    }

    // Upload placeholder symbol if exists
    const placeholderUrl = await this.uploadPlaceholderSymbol(bucketName, accessToken)
    if (placeholderUrl) {
      symbolUrls.set('PLACEHOLDER', placeholderUrl)
    }

    return { floorPlanUrl, scriptUrl, outputUrl, symbolUrls }
  }

  /**
   * Upload placeholder symbol from Supabase
   */
  private async uploadPlaceholderSymbol(bucketName: string, accessToken: string): Promise<string | null> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return null

    const placeholderPath = `${supabaseUrl}/storage/v1/object/public/product-symbols/PLACEHOLDER/PLACEHOLDER-SYMBOL.dwg`

    try {
      const response = await fetch(placeholderPath)
      if (!response.ok) return null

      const buffer = Buffer.from(await response.arrayBuffer())
      return await this.uploadToOss(bucketName, 'PLACEHOLDER-SYMBOL.dwg', buffer, accessToken)
    } catch {
      return null
    }
  }

  /**
   * Upload a buffer to OSS via Direct-to-S3
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
   * Generate signed URL for output file (read/write)
   */
  private async generateOutputUrl(bucketName: string, filename: string, accessToken: string): Promise<string> {
    const response = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects/${encodeURIComponent(filename)}/signed?access=readwrite`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutesExpiration: 60 }),
      }
    )

    const { signedUrl } = (await response.json()) as { signedUrl: string }
    return signedUrl
  }

  /**
   * Submit WorkItem to run the Activity
   */
  private async submitWorkItem(
    bucketName: string,
    uploadResult: {
      floorPlanUrl: string
      scriptUrl: string
      outputUrl: string
      symbolUrls: Map<string, string>
    },
    symbols: SymbolInfo[],
    outputFilename: string
  ): Promise<string> {
    const accessToken = await this.authService.getAccessToken()

    // Build arguments
    const args: Record<string, object> = {
      inputDwg: { url: uploadResult.floorPlanUrl, verb: 'get' },
      script: { url: uploadResult.scriptUrl, verb: 'get' },
      output: { url: uploadResult.outputUrl, verb: 'put', localName: outputFilename },
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

    // Add placeholder
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
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(workItemSpec),
    })

    if (!response.ok) {
      throw new Error(`WorkItem submission failed: ${await response.text()}`)
    }

    const data = (await response.json()) as { id: string }
    return data.id
  }

  /**
   * Monitor WorkItem until completion
   */
  private async monitorWorkItem(
    workItemId: string,
    onProgress: (phase: string, message: string, detail?: string) => void
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
        // Extract meaningful error from report
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

  /**
   * Download generated DWG from output URL
   */
  private async downloadDwg(outputUrl: string): Promise<Buffer> {
    const response = await fetch(outputUrl)

    if (!response.ok) {
      throw new Error(`Failed to download output DWG: ${response.statusText}`)
    }

    return Buffer.from(await response.arrayBuffer())
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Utilities
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Extract filename from a full path
   */
  private getFilenameFromPath(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1]
  }
}

// Export singleton factory
export function getXrefGeneratorService(): XrefGeneratorService {
  return new XrefGeneratorService()
}
