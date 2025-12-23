/**
 * Screenshot Utility
 *
 * Capture page screenshots using html2canvas and upload to Supabase Storage.
 */

import html2canvas from 'html2canvas'

export interface ScreenshotResult {
  dataUrl: string
  blob: Blob
  width: number
  height: number
}

export interface UploadResult {
  url: string
  filename: string
  size: number
  type: 'screenshot'
  path: string
}

/**
 * Capture a screenshot of the current page
 *
 * @param options - html2canvas options
 * @returns Screenshot as data URL and blob
 */
export async function captureScreenshot(options?: {
  scale?: number
  quality?: number
  ignoreElements?: (element: Element) => boolean
}): Promise<ScreenshotResult> {
  const scale = options?.scale ?? 0.5 // Reduce size by default
  const quality = options?.quality ?? 0.8

  // Default: ignore the feedback panel itself
  const defaultIgnore = (element: Element): boolean => {
    // Ignore elements with data-feedback-ignore attribute
    if (element.hasAttribute?.('data-feedback-ignore')) {
      return true
    }
    // Ignore the feedback panel (will be marked with this attribute)
    if (element.id === 'feedback-chat-panel') {
      return true
    }
    return false
  }

  const ignoreElements = options?.ignoreElements ?? defaultIgnore

  const canvas = await html2canvas(document.body, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: null,
    ignoreElements,
    // Reduce memory usage
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
  })

  const dataUrl = canvas.toDataURL('image/png', quality)

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve({
          dataUrl,
          blob: blob!,
          width: canvas.width,
          height: canvas.height,
        })
      },
      'image/png',
      quality
    )
  })
}

/**
 * Upload a screenshot to the feedback storage
 *
 * @param blob - Screenshot blob
 * @param chatId - Chat ID (optional, for organizing files)
 * @returns Upload result with URL
 */
export async function uploadScreenshot(
  blob: Blob,
  chatId?: string
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', blob, `screenshot-${Date.now()}.png`)
  formData.append('is_screenshot', 'true')
  if (chatId) {
    formData.append('chat_id', chatId)
  }

  const response = await fetch('/api/feedback/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload screenshot')
  }

  return response.json()
}

/**
 * Upload a file (image or PDF) to the feedback storage
 *
 * @param file - File to upload
 * @param chatId - Chat ID (optional)
 * @returns Upload result with URL
 */
export async function uploadFile(
  file: File,
  chatId?: string
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  if (chatId) {
    formData.append('chat_id', chatId)
  }

  const response = await fetch('/api/feedback/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload file')
  }

  return response.json()
}

/**
 * Capture and upload a screenshot in one step
 *
 * @param chatId - Chat ID (optional)
 * @returns Upload result with URL
 */
export async function captureAndUploadScreenshot(
  chatId?: string
): Promise<UploadResult> {
  const { blob } = await captureScreenshot()
  return uploadScreenshot(blob, chatId)
}
