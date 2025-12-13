/**
 * Vision Service for Symbol Generator
 *
 * Calls OpenRouter API with Claude vision model for multimodal analysis.
 * Fetches product images and converts to base64 for API submission.
 */

import sharp from 'sharp'
import {
  VisionMessage,
  VisionContentPart,
  OpenRouterVisionResponse,
  VisionAnalysisResult,
  SymbolAnalysisRequest,
  VISION_MODEL_PRICING,
  DEFAULT_VISION_MODEL,
} from './types'
import { SYMBOL_ANALYSIS_SYSTEM_PROMPT, buildUserPrompt } from './prompts'
import { formatDimensionsForPrompt, getDimensionsList } from './dimension-utils'

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const IMAGE_FETCH_TIMEOUT = 15000 // 15 seconds
const MAX_IMAGE_SIZE = 512 // Max dimension for vision API

// Allowed domains for image fetching (same as image proxy)
const ALLOWED_DOMAINS = [
  'deltalight.com',
  'www.deltalight.com',
  'meyer-lighting.com',
  'www.meyer-lighting.com',
  'dga.it',
  'www.dga.it',
]

// Valid media types for Claude Vision API
const VALID_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type ValidMediaType = typeof VALID_MEDIA_TYPES[number]

/**
 * Normalize content-type to a valid Claude Vision media type
 */
function normalizeMediaType(contentType: string): ValidMediaType {
  const ct = contentType.toLowerCase().split(';')[0].trim()

  // Map common variations
  if (ct === 'image/jpg' || ct === 'image/jpeg' || ct === 'image/pjpeg') {
    return 'image/jpeg'
  }
  if (ct === 'image/png' || ct === 'image/x-png') {
    return 'image/png'
  }
  if (ct === 'image/gif') {
    return 'image/gif'
  }
  if (ct === 'image/webp') {
    return 'image/webp'
  }

  // Default to JPEG for unknown types
  return 'image/jpeg'
}

/**
 * Check if buffer contains SVG content
 */
function isSvgContent(buffer: Buffer): boolean {
  const content = buffer.toString('utf8', 0, 1000).toLowerCase()
  return content.includes('<svg')
}

/**
 * Convert SVG buffer to PNG using Sharp
 * Uses Sharp's built-in SVG support via librsvg
 */
async function convertSvgToPng(svgBuffer: Buffer): Promise<Buffer> {
  const result = await sharp(svgBuffer)
    .resize({
      width: MAX_IMAGE_SIZE,
      height: MAX_IMAGE_SIZE,
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      withoutEnlargement: false,
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer()
  return Buffer.from(result)
}

/**
 * Check if URL is from an allowed domain
 */
function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    if (!['http:', 'https:'].includes(url.protocol)) return false

    const hostname = url.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.')
    ) {
      return false
    }

    return ALLOWED_DOMAINS.some(
      domain => hostname === domain || hostname.endsWith('.' + domain)
    )
  } catch {
    return false
  }
}

/**
 * Check if URL points to an unsupported format that can't be converted
 * SVG is now supported (converted to PNG), but BMP/TIFF/etc are not
 */
function isUnsupportedFormat(url: string): boolean {
  const ext = url.toLowerCase().split('?')[0].split('.').pop()
  const unsupportedFormats = ['bmp', 'tiff', 'tif', 'ico', 'pdf']
  return unsupportedFormats.includes(ext || '')
}

/**
 * Fetch an image and convert to base64 data URL
 * SVG images are converted to PNG using Sharp
 * Returns undefined if fetch fails (non-blocking)
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string | undefined> {
  if (!imageUrl || !isAllowedUrl(imageUrl)) {
    console.log(`[vision] Skipping disallowed URL: ${imageUrl?.substring(0, 50)}...`)
    return undefined
  }

  // Skip truly unsupported formats (BMP, TIFF, etc.)
  if (isUnsupportedFormat(imageUrl)) {
    console.log(`[vision] Skipping unsupported format: ${imageUrl.substring(0, 80)}...`)
    return undefined
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT)

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FOSSAPP/1.0 Symbol Generator',
        'Accept': 'image/*',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.log(`[vision] Image fetch failed (${response.status}): ${imageUrl.substring(0, 50)}...`)
      return undefined
    }

    const rawContentType = response.headers.get('content-type') || 'image/jpeg'
    let buffer: Buffer = Buffer.from(await response.arrayBuffer())
    let mediaType: ValidMediaType = 'image/png'

    // Check if SVG (by content-type or actual content)
    const isSvg = rawContentType.includes('svg') || isSvgContent(buffer)

    if (isSvg) {
      // Convert SVG to PNG
      console.log(`[vision] Converting SVG to PNG: ${imageUrl.substring(0, 50)}...`)
      try {
        buffer = await convertSvgToPng(buffer)
        mediaType = 'image/png'
        console.log(`[vision] SVG converted to PNG (${Math.round(buffer.byteLength / 1024)}KB)`)
      } catch (svgError) {
        console.log(`[vision] SVG conversion failed: ${svgError instanceof Error ? svgError.message : 'Unknown'}`)
        return undefined
      }
    } else {
      mediaType = normalizeMediaType(rawContentType)
    }

    // Convert to base64 data URL
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${mediaType};base64,${base64}`

    console.log(`[vision] Fetched image (${Math.round(buffer.byteLength / 1024)}KB, ${mediaType}): ${imageUrl.substring(0, 50)}...`)
    return dataUrl
  } catch (error) {
    console.log(`[vision] Image fetch error: ${error instanceof Error ? error.message : 'Unknown'}`)
    return undefined
  }
}

/**
 * Build multimodal message with text and optional images
 */
function buildVisionMessages(
  systemPrompt: string,
  userPrompt: string,
  imageBase64?: string,
  drawingBase64?: string
): VisionMessage[] {
  const messages: VisionMessage[] = [
    { role: 'system', content: systemPrompt }
  ]

  // Build user message content
  const content: VisionContentPart[] = [
    { type: 'text', text: userPrompt }
  ]

  // Add images if available
  if (imageBase64) {
    content.push({
      type: 'image_url',
      image_url: { url: imageBase64 }
    })
  }

  if (drawingBase64) {
    content.push({
      type: 'image_url',
      image_url: { url: drawingBase64 }
    })
  }

  messages.push({ role: 'user', content })

  return messages
}

/**
 * Call OpenRouter API with vision-capable model
 */
async function callVisionLLM(
  messages: VisionMessage[],
  model: string = DEFAULT_VISION_MODEL
): Promise<{
  content: string
  tokensIn: number
  tokensOut: number
  costUsd: number
}> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable not set')
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:8080',
      'X-Title': 'FOSSAPP Symbol Generator',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[vision] OpenRouter API error (${response.status}):`, errorText)

    // Create user-friendly error messages instead of raw API responses
    let userMessage: string
    const isHtmlResponse = errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')

    if (response.status === 503 || response.status === 502) {
      userMessage = 'AI service temporarily unavailable. Please try again in a few minutes.'
    } else if (response.status === 429) {
      userMessage = 'AI service rate limit exceeded. Please wait a moment and try again.'
    } else if (response.status === 401 || response.status === 403) {
      userMessage = 'AI service authentication error. Please contact support.'
    } else if (isHtmlResponse) {
      userMessage = `AI service error (${response.status}). Please try again later.`
    } else {
      // Try to extract JSON error message if available
      try {
        const errorJson = JSON.parse(errorText)
        userMessage = errorJson.error?.message || errorJson.message || `AI service error (${response.status})`
      } catch {
        userMessage = `AI service error (${response.status}). Please try again.`
      }
    }

    throw new Error(userMessage)
  }

  const result = (await response.json()) as OpenRouterVisionResponse
  const content = result.choices[0]?.message?.content || ''

  // Calculate cost
  const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 }
  const pricing = VISION_MODEL_PRICING[model as keyof typeof VISION_MODEL_PRICING]
    || VISION_MODEL_PRICING[DEFAULT_VISION_MODEL]

  const costUsd =
    (usage.prompt_tokens * pricing.input) / 1_000_000 +
    (usage.completion_tokens * pricing.output) / 1_000_000

  return {
    content,
    tokensIn: usage.prompt_tokens,
    tokensOut: usage.completion_tokens,
    costUsd,
  }
}

/**
 * Main function: Analyze a product for symbol generation
 */
export async function analyzeForSymbol(
  request: SymbolAnalysisRequest
): Promise<VisionAnalysisResult> {
  const startTime = Date.now()

  const { product, dimensions, imageUrl, drawingUrl } = request

  // Fetch images (non-blocking - continue even if they fail)
  const [imageBase64, drawingBase64] = await Promise.all([
    imageUrl ? fetchImageAsBase64(imageUrl) : Promise.resolve(undefined),
    drawingUrl ? fetchImageAsBase64(drawingUrl) : Promise.resolve(undefined),
  ])

  const hadImage = !!imageBase64
  const hadDrawing = !!drawingBase64
  const dimensionsProvided = getDimensionsList(dimensions)

  // Build prompts
  const dimensionsText = formatDimensionsForPrompt(dimensions)
  const userPrompt = buildUserPrompt(
    product.description_short,
    product.class_name,
    product.foss_pid,
    dimensionsText,
    hadImage,
    hadDrawing
  )

  // Build messages
  const messages = buildVisionMessages(
    SYMBOL_ANALYSIS_SYSTEM_PROMPT,
    userPrompt,
    imageBase64,
    drawingBase64
  )

  try {
    // Call vision API
    const { content, tokensIn, tokensOut, costUsd } = await callVisionLLM(messages)

    const processingTimeMs = Date.now() - startTime

    return {
      success: true,
      description: content,
      model: DEFAULT_VISION_MODEL,
      tokensIn,
      tokensOut,
      costUsd,
      processingTimeMs,
      hadImage,
      hadDrawing,
      dimensionsProvided,
    }
  } catch (error) {
    const processingTimeMs = Date.now() - startTime

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Vision analysis failed',
      model: DEFAULT_VISION_MODEL,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      processingTimeMs,
      hadImage,
      hadDrawing,
      dimensionsProvided,
    }
  }
}
