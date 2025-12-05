/**
 * Image Processing Service for Tiles
 * Ported from genpng (Node.js/Express) to Next.js
 *
 * Uses Sharp for fast image conversion (60x faster than Puppeteer for SVGs)
 * Falls back to Puppeteer for complex SVGs if needed
 */

import sharp from 'sharp'

// Types
export interface ConversionOptions {
  width?: number
  height?: number
  dpi?: number
}

export interface ImageMetadata {
  width: number
  height: number
  format: string
  dpi: number
  sizeBytes: number
  sizeMB: string
}

export interface ConversionResult {
  success: boolean
  originalBuffer: Buffer
  convertedBuffer: Buffer
  convertedBase64: string
  metadata: ImageMetadata
  validationStatus: 'passed' | 'warning'
  validationIssues: string[]
  processTime: number
}

// Constants
const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB for Meyer print quality images
const DOWNLOAD_TIMEOUT = 120000 // 120 seconds for very large images

/**
 * Download image from URL
 */
export async function downloadImage(url: string): Promise<Buffer> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TilesApp/1.0',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Image not found')
      }
      throw new Error(`HTTP error: ${response.status}`)
    }

    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Image download timeout')
      }
      throw new Error(`Failed to download image: ${error.message}`)
    }
    throw error
  }
}

/**
 * Detect if buffer contains SVG content
 */
function isSvgContent(buffer: Buffer): boolean {
  const content = buffer.toString('utf8', 0, 1000).toLowerCase()
  return content.includes('<svg')
}

/**
 * Convert raster image (JPEG/PNG) to PNG with specified dimensions and DPI
 */
async function convertRasterImage(
  imageBuffer: Buffer,
  options: ConversionOptions
): Promise<Buffer> {
  const { width, height, dpi } = options

  let image = sharp(imageBuffer)

  // Resize if dimensions specified
  if (width || height) {
    image = image.resize({
      width: width || undefined,
      height: height || undefined,
      fit: 'inside',
      withoutEnlargement: false,
    })
  }

  // Set DPI metadata if specified
  if (dpi) {
    image = image.withMetadata({ density: dpi })
  }

  return image.png().toBuffer()
}

/**
 * Convert SVG to PNG using Sharp (fast, memory-efficient)
 * Uses Sharp's built-in SVG support via librsvg
 */
async function convertSvgWithSharp(
  svgBuffer: Buffer,
  options: ConversionOptions
): Promise<Buffer> {
  const { width = 800, height = 600, dpi = 300 } = options

  return sharp(svgBuffer)
    .resize({
      width,
      height,
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      withoutEnlargement: false,
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // Ensure white background for transparent SVGs
    .withMetadata({ density: dpi })
    .png()
    .toBuffer()
}

/**
 * Get image metadata
 */
export async function getImageMetadata(imageBuffer: Buffer): Promise<ImageMetadata> {
  const metadata = await sharp(imageBuffer).metadata()
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
    dpi: metadata.density || 72,
    sizeBytes: imageBuffer.length,
    sizeMB: (imageBuffer.length / (1024 * 1024)).toFixed(2),
  }
}

/**
 * Validate converted image properties
 */
async function validateImageProperties(
  imageBuffer: Buffer,
  options: ConversionOptions
): Promise<{
  valid: boolean
  issues: string[]
  metadata: ImageMetadata
}> {
  const { width: requestedWidth, height: requestedHeight, dpi: requestedDpi } = options
  const metadata = await getImageMetadata(imageBuffer)
  const issues: string[] = []

  // Validate format
  if (metadata.format !== 'png') {
    issues.push(`Format is ${metadata.format}, expected png`)
  }

  // Validate width (allow 1px difference for rounding)
  if (requestedWidth && Math.abs(metadata.width - requestedWidth) > 1) {
    issues.push(`Width is ${metadata.width}px, expected ${requestedWidth}px`)
  }

  // Validate height
  if (requestedHeight && Math.abs(metadata.height - requestedHeight) > 1) {
    issues.push(`Height is ${metadata.height}px, expected ${requestedHeight}px`)
  }

  // Validate DPI
  if (requestedDpi && Math.abs(metadata.dpi - requestedDpi) > 1) {
    issues.push(`DPI is ${metadata.dpi}, expected ${requestedDpi}`)
  }

  // Validate file size
  if (imageBuffer.length > MAX_FILE_SIZE) {
    issues.push(`File size ${metadata.sizeMB}MB exceeds limit`)
  }

  return {
    valid: issues.length === 0,
    issues,
    metadata,
  }
}

/**
 * Convert buffer to base64 string
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64')
}

/**
 * Convert base64 string to buffer
 */
export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64')
}

/**
 * Main conversion function - converts image from URL to PNG
 * Uses Sharp for all conversions (fast path)
 */
export async function convertImage(
  imageUrl: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const startTime = Date.now()

  // Download image
  const originalBuffer = await downloadImage(imageUrl)

  // Detect if SVG
  const isSvg = isSvgContent(originalBuffer)

  let convertedBuffer: Buffer

  if (isSvg) {
    // SVG conversion
    convertedBuffer = await convertSvgWithSharp(originalBuffer, options)
  } else {
    // Raster image conversion (JPEG/PNG)
    convertedBuffer = await convertRasterImage(originalBuffer, options)
  }

  // Validate result
  const validation = await validateImageProperties(convertedBuffer, options)

  const processTime = (Date.now() - startTime) / 1000

  return {
    success: true,
    originalBuffer,
    convertedBuffer,
    convertedBase64: bufferToBase64(convertedBuffer),
    metadata: validation.metadata,
    validationStatus: validation.valid ? 'passed' : 'warning',
    validationIssues: validation.issues,
    processTime,
  }
}

/**
 * Process multiple images in parallel
 */
export async function convertImages(
  items: Array<{
    imageUrl?: string
    drawingUrl?: string
    imageFilename: string
    drawingFilename: string
    width?: number
    height?: number
    dpi?: number
  }>
): Promise<
  Array<{
    imageFilename: string
    drawingFilename: string
    imageResult?: ConversionResult
    drawingResult?: ConversionResult
    errors: string[]
  }>
> {
  const results = await Promise.all(
    items.map(async (item) => {
      const errors: string[] = []
      let imageResult: ConversionResult | undefined
      let drawingResult: ConversionResult | undefined

      const options: ConversionOptions = {
        width: item.width || 1500,
        height: item.height || 1500,
        dpi: item.dpi || 300,
      }

      // Convert image if URL provided
      if (item.imageUrl) {
        try {
          imageResult = await convertImage(item.imageUrl, options)
        } catch (error) {
          errors.push(
            `Image conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      // Convert drawing if URL provided
      if (item.drawingUrl) {
        try {
          drawingResult = await convertImage(item.drawingUrl, options)
        } catch (error) {
          errors.push(
            `Drawing conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      return {
        imageFilename: item.imageFilename,
        drawingFilename: item.drawingFilename,
        imageResult,
        drawingResult,
        errors,
      }
    })
  )

  return results
}
