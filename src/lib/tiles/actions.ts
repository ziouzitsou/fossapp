'use server'

/**
 * Server Actions for Tile Processing
 * These run on the server and can access Node.js APIs like Sharp
 */

import { convertImage, convertImages, base64ToBuffer } from './image-processor'
import { generateTileScript, previewTileScript, type TileData } from '@fossapp/tiles/scripts'
import { apsService } from './aps'
import { getGoogleDriveTileService, type TileUploadResult } from './google-drive-tile-service'

export interface TilePayload {
  tile: string
  tileId: string
  members: Array<{
    productId: string
    imageUrl: string
    drawingUrl: string
    imageFilename: string
    drawingFilename: string
    tileText: string
    width: number
    height: number
    dpi: number
    tileWidth: number
    tileHeight: number
  }>
}

export interface ProcessedImage {
  filename: string
  base64: string
  width: number
  height: number
  dpi: number
  sizeBytes: number
  processingTime: number
}

export interface TileProcessingResult {
  success: boolean
  tileName: string
  tileId: string
  processedImages: ProcessedImage[]
  errors: string[]
  totalProcessingTime: number
}

/**
 * Test image conversion - useful for debugging
 */
export async function testImageConversion(imageUrl: string) {
  try {
    const result = await convertImage(imageUrl, {
      width: 500,
      height: 500,
      dpi: 300,
    })

    return {
      success: true,
      metadata: result.metadata,
      validationStatus: result.validationStatus,
      validationIssues: result.validationIssues,
      processTime: result.processTime,
      // Return a small preview for testing
      previewBase64: result.convertedBase64.substring(0, 100) + '...',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process a full tile - converts all images/drawings to PNG
 */
export async function processTileImages(payload: TilePayload): Promise<TileProcessingResult> {
  const startTime = Date.now()
  const processedImages: ProcessedImage[] = []
  const errors: string[] = []

  // Process all members in parallel
  const results = await convertImages(
    payload.members.map((member) => ({
      imageUrl: member.imageUrl || undefined,
      drawingUrl: member.drawingUrl || undefined,
      imageFilename: member.imageFilename,
      drawingFilename: member.drawingFilename,
      width: member.width,
      height: member.height,
      dpi: member.dpi,
    }))
  )

  // Collect results
  for (const result of results) {
    // Add any errors
    errors.push(...result.errors)

    // Add image result if successful
    if (result.imageResult) {
      processedImages.push({
        filename: result.imageFilename,
        base64: result.imageResult.convertedBase64,
        width: result.imageResult.metadata.width,
        height: result.imageResult.metadata.height,
        dpi: result.imageResult.metadata.dpi,
        sizeBytes: result.imageResult.metadata.sizeBytes,
        processingTime: result.imageResult.processTime,
      })
    }

    // Add drawing result if successful
    if (result.drawingResult) {
      processedImages.push({
        filename: result.drawingFilename,
        base64: result.drawingResult.convertedBase64,
        width: result.drawingResult.metadata.width,
        height: result.drawingResult.metadata.height,
        dpi: result.drawingResult.metadata.dpi,
        sizeBytes: result.drawingResult.metadata.sizeBytes,
        processingTime: result.drawingResult.processTime,
      })
    }
  }

  const totalProcessingTime = (Date.now() - startTime) / 1000

  return {
    success: errors.length === 0,
    tileName: payload.tile,
    tileId: payload.tileId,
    processedImages,
    errors,
    totalProcessingTime,
  }
}

/**
 * Generate tile processing summary without actual conversion
 * Useful for previewing what will be processed
 */
export async function previewTileProcessing(payload: TilePayload) {
  const summary = {
    tileName: payload.tile,
    tileId: payload.tileId,
    memberCount: payload.members.length,
    expectedImages: 0,
    expectedDrawings: 0,
    members: payload.members.map((m) => ({
      productId: m.productId,
      hasImage: !!m.imageUrl,
      hasDrawing: !!m.drawingUrl,
      imageFilename: m.imageFilename,
      drawingFilename: m.drawingFilename,
      tileText: m.tileText,
      dimensions: `${m.width}x${m.height} @ ${m.dpi}dpi`,
    })),
  }

  summary.expectedImages = summary.members.filter((m) => m.hasImage).length
  summary.expectedDrawings = summary.members.filter((m) => m.hasDrawing).length

  return summary
}

/**
 * Generate AutoLISP script for a tile
 * This creates the .scr file content for AutoCAD
 */
export async function generateScript(payload: TilePayload) {
  // Convert payload to TileData format for script generator
  const tileData: TileData = {
    tile: payload.tile,
    tileId: payload.tileId,
    members: payload.members.map((m) => ({
      productId: m.productId,
      imageFilename: m.imageFilename,
      drawingFilename: m.drawingFilename,
      tileText: m.tileText,
      width: m.width,
      height: m.height,
      dpi: m.dpi,
      tileWidth: m.tileWidth,
      tileHeight: m.tileHeight,
    })),
  }

  const preview = previewTileScript(tileData)
  const script = generateTileScript(tileData)

  return {
    success: true,
    tileName: payload.tile,
    tileId: payload.tileId,
    preview,
    script,
    scriptLines: script.split('\n').length,
    scriptLength: script.length,
  }
}

/**
 * Full tile processing pipeline:
 * 1. Convert images to PNG
 * 2. Generate AutoLISP script
 */
export async function processTileFull(payload: TilePayload) {
  const startTime = Date.now()
  const errors: string[] = []

  // Step 1: Process images
  const imageResult = await processTileImages(payload)
  errors.push(...imageResult.errors)

  // Step 2: Generate script
  const scriptResult = await generateScript(payload)

  const totalTime = (Date.now() - startTime) / 1000

  return {
    success: errors.length === 0,
    tileName: payload.tile,
    tileId: payload.tileId,
    images: imageResult,
    script: scriptResult,
    errors,
    totalProcessingTime: totalTime,
  }
}

/**
 * Full DWG generation pipeline via APS Design Automation:
 * 1. Convert images to PNG
 * 2. Generate AutoLISP script
 * 3. Submit to APS Design Automation
 * 4. Download DWG and upload to Google Drive
 * 5. Return DWG download URL and Google Drive link
 */
export async function generateDwg(payload: TilePayload) {
  const startTime = Date.now()
  const errors: string[] = []
  let driveUploadResult: TileUploadResult | null = null

  const logStep = (step: string, details?: string) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[${elapsed}s] ${step}${details ? ` - ${details}` : ''}`)
  }

  try {
    logStep('GENERATE DWG STARTED', `${payload.tile} (${payload.members.length} members)`)

    // Step 1: Process images to PNG
    logStep('Processing images...', `${payload.members.length * 2} files (images + drawings)`)
    const imageResult = await processTileImages(payload)

    // STOP if image processing failed
    if (!imageResult.success || imageResult.processedImages.length === 0) {
      const errorMsg = imageResult.errors.length > 0
        ? imageResult.errors.join(', ')
        : 'No images were processed successfully'
      logStep('STOPPED - Image processing failed', errorMsg)
      return {
        success: false,
        tileName: payload.tile,
        tileId: payload.tileId,
        dwgUrl: '',
        workItemId: '',
        processingLogs: [],
        images: imageResult,
        script: null,
        driveUpload: null,
        errors: [errorMsg],
        totalProcessingTime: (Date.now() - startTime) / 1000,
      }
    }
    logStep('Images processed', `${imageResult.processedImages.length} files`)

    // Step 2: Generate script
    logStep('Generating AutoLISP script...')
    const scriptResult = await generateScript(payload)
    logStep('Script generated', `${scriptResult.scriptLines} lines`)

    // Step 3: Prepare image buffers for APS
    const imageBuffers = imageResult.processedImages.map((img) => ({
      filename: img.filename,
      buffer: base64ToBuffer(img.base64),
    }))

    // Step 4: Submit to APS Design Automation
    logStep('Starting APS Design Automation...')
    const apsResult = await apsService.processTile(
      scriptResult.script,
      imageBuffers,
      payload.tile
    )

    // STOP if APS processing failed
    if (!apsResult.success) {
      logStep('STOPPED - APS processing failed', apsResult.errors.join(', '))
      return {
        success: false,
        tileName: payload.tile,
        tileId: payload.tileId,
        dwgUrl: '',
        workItemId: apsResult.workItemId,
        processingLogs: apsResult.processingLogs,
        images: imageResult,
        script: scriptResult,
        driveUpload: null,
        errors: apsResult.errors,
        totalProcessingTime: (Date.now() - startTime) / 1000,
      }
    }

    // Step 5: Upload to Google Drive (DWG generated successfully)
    if (apsResult.dwgBuffer) {
      try {
        logStep('Uploading to Google Drive...', `${(apsResult.dwgBuffer.length / 1024).toFixed(0)} KB DWG + ${imageResult.processedImages.length} images`)

        // Prepare images for upload
        const imagesToUpload = imageResult.processedImages.map((img) => ({
          name: img.filename,
          buffer: base64ToBuffer(img.base64),
        }))

        // Upload to Google Drive (including report and script for debugging)
        const driveService = getGoogleDriveTileService()
        driveUploadResult = await driveService.uploadTileFiles(
          payload.tile,
          apsResult.dwgBuffer,
          imagesToUpload,
          apsResult.workItemReport, // Include report for debugging
          scriptResult.script // Include .scr for local testing with accoreconsole.exe
        )

        if (driveUploadResult.success) {
          logStep('Google Drive upload complete', driveUploadResult.tileFolderLink)
        } else {
          errors.push(...driveUploadResult.errors)
          logStep('Google Drive upload FAILED', driveUploadResult.errors.join(', '))
        }
      } catch (driveError) {
        const driveErrorMsg = `Google Drive upload failed: ${driveError instanceof Error ? driveError.message : 'Unknown error'}`
        errors.push(driveErrorMsg)
        logStep('Google Drive upload FAILED', driveErrorMsg)
      }
    }

    const totalTime = (Date.now() - startTime) / 1000
    const driveSuccess = driveUploadResult?.success ?? false
    logStep(driveSuccess ? 'GENERATE DWG COMPLETE' : 'DWG GENERATED BUT DRIVE UPLOAD FAILED', `${totalTime.toFixed(1)}s total`)

    return {
      success: driveSuccess, // Only fully successful if Drive upload worked
      tileName: payload.tile,
      tileId: payload.tileId,
      dwgUrl: apsResult.dwgUrl,
      workItemId: apsResult.workItemId,
      processingLogs: apsResult.processingLogs,
      images: imageResult,
      script: scriptResult,
      // Google Drive results
      driveUpload: driveUploadResult ? {
        success: driveUploadResult.success,
        folderLink: driveUploadResult.tileFolderLink,
        files: driveUploadResult.files,
      } : null,
      errors,
      totalProcessingTime: totalTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    errors.push(errorMessage)

    return {
      success: false,
      tileName: payload.tile,
      tileId: payload.tileId,
      dwgUrl: '',
      workItemId: '',
      processingLogs: [],
      images: null,
      script: null,
      driveUpload: null,
      errors,
      totalProcessingTime: (Date.now() - startTime) / 1000,
    }
  }
}

/**
 * Test APS authentication
 */
export async function testApsAuth() {
  return apsService.testAuthentication()
}
