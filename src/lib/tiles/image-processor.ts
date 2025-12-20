/**
 * Image Processing Service for Tiles
 * Ported from genpng (Node.js/Express) to Next.js
 *
 * Uses Sharp for fast image conversion (60x faster than Puppeteer for SVGs)
 * Falls back to Puppeteer for complex SVGs if needed
 */

import sharp from 'sharp'

// Font mapping: SVG font names -> Available system fonts (Liberation/DejaVu/Noto)
// Liberation fonts are metric-compatible with Microsoft fonts
const FONT_MAPPINGS: Record<string, string[]> = {
  // Arial family -> Liberation Sans
  'arial': ['Liberation Sans', 'DejaVu Sans', 'Noto Sans'],
  'arialmt': ['Liberation Sans', 'DejaVu Sans', 'Noto Sans'],
  'arial mt': ['Liberation Sans', 'DejaVu Sans', 'Noto Sans'],
  'helvetica': ['Liberation Sans', 'DejaVu Sans', 'Noto Sans'],
  'helvetica neue': ['Liberation Sans', 'DejaVu Sans', 'Noto Sans'],
  'sans-serif': ['Liberation Sans', 'DejaVu Sans', 'Noto Sans'],
  // Times family -> Liberation Serif
  'times': ['Liberation Serif', 'DejaVu Serif', 'Noto Serif'],
  'times new roman': ['Liberation Serif', 'DejaVu Serif', 'Noto Serif'],
  'serif': ['Liberation Serif', 'DejaVu Serif', 'Noto Serif'],
  // Courier family -> Liberation Mono
  'courier': ['Liberation Mono', 'DejaVu Sans Mono', 'Noto Mono'],
  'courier new': ['Liberation Mono', 'DejaVu Sans Mono', 'Noto Mono'],
  'monospace': ['Liberation Mono', 'DejaVu Sans Mono', 'Noto Mono'],
}

// Fonts that are available in our Docker image
const AVAILABLE_FONTS = new Set([
  'liberation sans', 'liberation serif', 'liberation mono',
  'dejavu sans', 'dejavu serif', 'dejavu sans mono',
  'noto sans', 'noto serif', 'noto mono',
])

/**
 * Extract font-family declarations from SVG content
 */
function extractSvgFonts(svgContent: string): string[] {
  const fonts = new Set<string>()

  // Match font-family in style attributes: font-family="Arial, sans-serif"
  const attrRegex = /font-family=["']([^"']+)["']/gi
  let match
  while ((match = attrRegex.exec(svgContent)) !== null) {
    match[1].split(',').forEach(font => {
      fonts.add(font.trim().replace(/["']/g, ''))
    })
  }

  // Match font-family in CSS: font-family: Arial, sans-serif;
  const cssRegex = /font-family:\s*([^;}"']+)/gi
  while ((match = cssRegex.exec(svgContent)) !== null) {
    match[1].split(',').forEach(font => {
      fonts.add(font.trim().replace(/["']/g, ''))
    })
  }

  return Array.from(fonts)
}

/**
 * Validate that SVG fonts are available or have mappings
 * Throws an error with missing font details
 */
function validateSvgFonts(svgContent: string): { valid: boolean; missingFonts: string[]; warnings: string[] } {
  const fonts = extractSvgFonts(svgContent)
  const missingFonts: string[] = []
  const warnings: string[] = []

  for (const font of fonts) {
    const fontLower = font.toLowerCase()

    // Check if font is directly available
    if (AVAILABLE_FONTS.has(fontLower)) {
      continue
    }

    // Check if we have a mapping for this font
    if (FONT_MAPPINGS[fontLower]) {
      warnings.push(`Font "${font}" will be substituted with "${FONT_MAPPINGS[fontLower][0]}"`)
      continue
    }

    // Check partial matches (e.g., "ArialMT" contains "arial")
    const hasMapping = Object.keys(FONT_MAPPINGS).some(key =>
      fontLower.includes(key) || key.includes(fontLower)
    )

    if (hasMapping) {
      warnings.push(`Font "${font}" will be substituted with a compatible font`)
      continue
    }

    // Font is not available and has no mapping
    missingFonts.push(font)
  }

  return {
    valid: missingFonts.length === 0,
    missingFonts,
    warnings
  }
}

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
 * Detect if image is a "dark theme" image (white/light lines on transparent background)
 * These images are designed to be displayed on dark backgrounds and need inversion
 * for light backgrounds or DWG generation.
 *
 * Detection criteria:
 * - Image has alpha channel with significant variation (transparency used for drawing)
 * - Color/gray pixels are predominantly white (>= 250)
 */
async function isDarkThemeImage(imageBuffer: Buffer): Promise<{ isDarkTheme: boolean; reason: string }> {
  try {
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()

    // Must have alpha channel
    if (!metadata.hasAlpha) {
      return { isDarkTheme: false, reason: 'No alpha channel' }
    }

    // Get raw pixel data
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true })

    const channels = info.channels
    const pixels = info.width * info.height

    // Analyze pixels
    let whitePixelCount = 0
    let _coloredPixelCount = 0 // Tracked but not used in final calculation
    let transparentPixelCount = 0
    let opaquePixelCount = 0

    for (let i = 0; i < data.length; i += channels) {
      const alpha = channels === 4 ? data[i + 3] : (channels === 2 ? data[i + 1] : 255)

      if (alpha < 10) {
        transparentPixelCount++
        continue
      }

      opaquePixelCount++

      // Check if pixel is white/near-white
      if (channels === 2) {
        // Grayscale + alpha
        const gray = data[i]
        if (gray >= 250) whitePixelCount++
        else _coloredPixelCount++
      } else if (channels === 4) {
        // RGBA
        const r = data[i], g = data[i + 1], b = data[i + 2]
        if (r >= 250 && g >= 250 && b >= 250) whitePixelCount++
        else _coloredPixelCount++
      } else if (channels === 3) {
        // RGB (no alpha, but we check anyway)
        const r = data[i], g = data[i + 1], b = data[i + 2]
        if (r >= 250 && g >= 250 && b >= 250) whitePixelCount++
        else _coloredPixelCount++
      } else if (channels === 1) {
        // Grayscale only
        if (data[i] >= 250) whitePixelCount++
        else _coloredPixelCount++
      }
    }

    // Criteria for dark theme image:
    // 1. Most of the image is transparent (drawing uses alpha for lines)
    // 2. Non-transparent pixels are predominantly white
    const transparentRatio = transparentPixelCount / pixels
    const whiteRatio = opaquePixelCount > 0 ? whitePixelCount / opaquePixelCount : 0

    // If >50% transparent AND >90% of visible pixels are white → dark theme image
    if (transparentRatio > 0.5 && whiteRatio > 0.9) {
      return {
        isDarkTheme: true,
        reason: `${(transparentRatio * 100).toFixed(0)}% transparent, ${(whiteRatio * 100).toFixed(0)}% white pixels`
      }
    }

    return {
      isDarkTheme: false,
      reason: `${(transparentRatio * 100).toFixed(0)}% transparent, ${(whiteRatio * 100).toFixed(0)}% white pixels`
    }
  } catch (error) {
    console.warn('[Dark Theme Detection] Error analyzing image:', error)
    return { isDarkTheme: false, reason: 'Analysis error' }
  }
}

/**
 * Invert a dark theme image (white on transparent) to light theme (black on white)
 * For Meyer-style images where alpha channel defines the drawing:
 * - Extract alpha channel as grayscale (alpha IS the drawing)
 * - Invert so high alpha (lines) becomes black, low alpha (background) becomes white
 */
async function invertDarkThemeImage(imageBuffer: Buffer): Promise<Buffer> {
  // Strategy for alpha-based drawings (like Meyer):
  // The alpha channel IS the drawing - extract it, invert it
  // High alpha (visible lines) → black (0)
  // Low alpha (transparent background) → white (255)

  // First ensure we have RGBA format
  const rgba = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data, info } = rgba
  const { width, height, channels } = info

  // Create new buffer: use inverted alpha as grayscale
  const outputPixels = Buffer.alloc(width * height)

  for (let i = 0; i < width * height; i++) {
    const alpha = data[i * channels + (channels - 1)] // Last channel is alpha
    outputPixels[i] = 255 - alpha // Invert: high alpha → black (0), low → white (255)
  }

  // Create grayscale PNG from the inverted alpha
  return sharp(outputPixels, {
    raw: { width, height, channels: 1 }
  })
    .png()
    .toBuffer()
}

/**
 * Convert raster image (JPEG/PNG) to PNG with specified dimensions and DPI
 * Automatically detects and inverts dark theme images (white on transparent)
 */
async function convertRasterImage(
  imageBuffer: Buffer,
  options: ConversionOptions
): Promise<Buffer> {
  const { width, height, dpi } = options

  // Check if this is a dark theme image that needs inversion
  const darkThemeCheck = await isDarkThemeImage(imageBuffer)

  let processedBuffer = imageBuffer
  if (darkThemeCheck.isDarkTheme) {
    console.log(`[Image] Dark theme image detected (${darkThemeCheck.reason}) - inverting for light background`)
    processedBuffer = await invertDarkThemeImage(imageBuffer)
  }

  let image = sharp(processedBuffer)

  // Resize if dimensions specified
  if (width || height) {
    image = image.resize({
      width: width || undefined,
      height: height || undefined,
      fit: 'inside',
      withoutEnlargement: false,
    })
  }

  // Ensure white background for any remaining transparency
  image = image.flatten({ background: { r: 255, g: 255, b: 255 } })

  // Set DPI metadata if specified
  if (dpi) {
    image = image.withMetadata({ density: dpi })
  }

  return image.png().toBuffer()
}

/**
 * Convert SVG to PNG using Sharp (fast, memory-efficient)
 * Uses Sharp's built-in SVG support via librsvg
 * Validates fonts before conversion and throws error if fonts are missing
 */
async function convertSvgWithSharp(
  svgBuffer: Buffer,
  options: ConversionOptions
): Promise<Buffer> {
  const { width = 800, height = 600, dpi = 300 } = options

  // Validate SVG fonts before conversion
  const svgContent = svgBuffer.toString('utf8')
  const fontValidation = validateSvgFonts(svgContent)

  if (!fontValidation.valid) {
    throw new Error(
      `SVG contains unsupported fonts that cannot be rendered: ${fontValidation.missingFonts.join(', ')}. ` +
      `Please use standard fonts (Arial, Helvetica, Times, Courier) or embed fonts in the SVG.`
    )
  }

  // Log font substitution warnings
  if (fontValidation.warnings.length > 0) {
    console.log('[SVG Font] ' + fontValidation.warnings.join('; '))
  }

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

      // Convert image and drawing in parallel
      const conversionTasks: Array<{ type: 'image' | 'drawing'; url: string }> = []
      if (item.imageUrl) {
        conversionTasks.push({ type: 'image', url: item.imageUrl })
      }
      if (item.drawingUrl) {
        conversionTasks.push({ type: 'drawing', url: item.drawingUrl })
      }

      const conversionResults = await Promise.allSettled(
        conversionTasks.map(async (task) => {
          const result = await convertImage(task.url, options)
          return { type: task.type, result }
        })
      )

      for (const res of conversionResults) {
        if (res.status === 'fulfilled') {
          if (res.value.type === 'image') {
            imageResult = res.value.result
          } else {
            drawingResult = res.value.result
          }
        } else {
          const type = conversionTasks.find((_, i) => conversionResults[i] === res)?.type || 'unknown'
          errors.push(
            `${type === 'image' ? 'Image' : 'Drawing'} conversion failed: ${res.reason instanceof Error ? res.reason.message : 'Unknown error'}`
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
