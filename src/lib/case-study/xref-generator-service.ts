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

import { XrefScriptGenerator } from './xref-script-generator'
import { getGoogleDriveProjectService } from '@/lib/google-drive-project-service'

// Sub-modules
import { XrefAuthService } from './xref-auth'
import { XrefApsOperations } from './xref-aps-operations'
import { fetchPlacementData, getSymbolInfo, buildXrefPlacements } from './xref-data-service'
import type {
  GenerateXrefRequest,
  GenerateXrefResult,
  ProgressCallback,
} from './xref-types'

// Re-export types for convenience
export type { GenerateXrefRequest, GenerateXrefResult }

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
  private authService = new XrefAuthService()
  private apsOps = new XrefApsOperations(this.authService)
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
    onProgress: ProgressCallback
  ): Promise<GenerateXrefResult> {
    const errors: string[] = []
    const missingSymbols: string[] = []

    try {
      // ─────────────────────────────────────────────────────────────────────
      // Step 1: Fetch placements and product info
      // ─────────────────────────────────────────────────────────────────────
      onProgress('init', 'Fetching placements...', `Area: ${request.areaCode}`)

      const { placements, floorPlanFilename } = await fetchPlacementData(
        request.areaRevisionId
      )

      if (placements.length === 0) {
        throw new Error('No placements found for this area')
      }

      const floorPlanUrn = request.floorPlanUrn
      onProgress('init', 'Placements loaded', `${placements.length} placements`)

      // ─────────────────────────────────────────────────────────────────────
      // Step 2: Get unique symbols and check which have DWGs
      // ─────────────────────────────────────────────────────────────────────
      onProgress('init', 'Checking symbol DWGs...')

      const symbols = await getSymbolInfo(placements)
      const symbolsWithDwg = symbols.filter(s => s.hasDwg)
      const symbolsWithoutDwg = symbols.filter(s => !s.hasDwg)

      if (symbolsWithoutDwg.length > 0) {
        missingSymbols.push(...symbolsWithoutDwg.map(s => s.fossPid))
        onProgress('init', 'Missing symbols detected', `${symbolsWithoutDwg.length} will use placeholder`)
      }

      // ─────────────────────────────────────────────────────────────────────
      // Step 3: Build XREF placements with paths
      // ─────────────────────────────────────────────────────────────────────
      const xrefPlacements = buildXrefPlacements(placements, symbols)

      // ─────────────────────────────────────────────────────────────────────
      // Step 4: Generate AutoLISP script
      // ─────────────────────────────────────────────────────────────────────
      onProgress('script', 'Generating AutoLISP script...')

      const outputFilename = `${request.projectCode}_${request.areaCode}_RV${request.revisionNumber}.dwg`
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
      await this.apsOps.createDynamicActivity(symbolsWithDwg)

      // ─────────────────────────────────────────────────────────────────────
      // Step 6: Use project bucket and prepare files
      // ─────────────────────────────────────────────────────────────────────
      const bucketName = request.ossBucket
      console.log('[XREF] Using project bucket:', bucketName)

      onProgress('aps', 'Getting floor plan URL...')
      console.log('[XREF] Floor plan URN:', floorPlanUrn)
      const floorPlanUrl = await this.apsOps.getSignedUrlForUrn(floorPlanUrn)
      console.log('[XREF] Floor plan URL obtained')

      onProgress('aps', 'Uploading script...', `script + ${symbolsWithDwg.length} symbols`)
      const uploadResult = await this.apsOps.uploadFilesForWorkItem(
        bucketName,
        floorPlanUrl,
        floorPlanFilename || 'input.dwg',
        scriptContent,
        symbolsWithDwg,
        outputFilename
      )

      // ─────────────────────────────────────────────────────────────────────
      // Step 7: Submit and monitor WorkItem
      // ─────────────────────────────────────────────────────────────────────
      onProgress('aps', 'Submitting WorkItem...')
      console.log('[XREF] Submitting WorkItem with', symbolsWithDwg.length, 'symbols')
      console.log('[XREF] Output URN:', uploadResult.outputUrl)
      const workItemId = await this.apsOps.submitWorkItem(uploadResult, symbolsWithDwg, outputFilename)
      console.log('[XREF] WorkItem submitted:', workItemId)

      onProgress('aps', 'Processing...', 'This may take 30-60 seconds')
      await this.apsOps.monitorWorkItem(workItemId, onProgress)

      // ─────────────────────────────────────────────────────────────────────
      // Step 8: Download output DWG
      // ─────────────────────────────────────────────────────────────────────
      onProgress('download', 'Downloading generated DWG...')
      console.log('[XREF] Downloading output from:', uploadResult.outputUrl.substring(0, 60) + '...')
      const outputDwgBuffer = await this.apsOps.downloadOutputDwg(bucketName, outputFilename)
      console.log('[XREF] Downloaded DWG:', outputDwgBuffer.length, 'bytes')
      onProgress('download', 'DWG downloaded', `${(outputDwgBuffer.length / 1024).toFixed(0)} KB`)

      // ─────────────────────────────────────────────────────────────────────
      // Step 9: Upload to Google Drive (if folder ID provided)
      // ─────────────────────────────────────────────────────────────────────
      let driveLink: string | undefined
      if (request.driveFolderId) {
        onProgress('drive', 'Uploading to Google Drive...')
        try {
          const driveService = getGoogleDriveProjectService()
          const driveResult = await driveService.uploadToAreaOutput(
            request.driveFolderId,
            outputFilename,
            outputDwgBuffer
          )
          if (driveResult.success && driveResult.webViewLink) {
            driveLink = driveResult.webViewLink
            onProgress('drive', 'Uploaded to Google Drive', outputFilename)
            // Cleanup: Delete output from bucket now that it's on Google Drive
            await this.apsOps.deleteOutputFromBucket(bucketName, outputFilename)
          } else {
            console.warn('Drive upload failed:', driveResult.error)
            onProgress('drive', 'Drive upload failed (file still generated)', driveResult.error)
          }
        } catch (driveError) {
          console.error('Drive upload error:', driveError)
          onProgress('drive', 'Drive upload error (file still generated)')
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Cleanup: Delete activity
      // ─────────────────────────────────────────────────────────────────────
      await this.apsOps.deleteActivity()

      return {
        success: true,
        outputDwgBuffer,
        outputFilename,
        driveLink,
        missingSymbols: missingSymbols.length > 0 ? missingSymbols : undefined,
        errors,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(errorMessage)

      // Cleanup on error
      await this.apsOps.deleteActivity()

      return {
        success: false,
        missingSymbols: missingSymbols.length > 0 ? missingSymbols : undefined,
        errors,
      }
    }
  }
}

/**
 * Factory function for XrefGeneratorService
 */
export function getXrefGeneratorService(): XrefGeneratorService {
  return new XrefGeneratorService()
}
