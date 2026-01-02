/**
 * useViewerApi Hook
 *
 * Handles API calls for the APS Viewer:
 * - Authentication token retrieval
 * - File upload (transient or persistent with caching)
 * - Translation status polling
 */

import { useCallback, useRef, useLayoutEffect } from 'react'
import type { TranslationStatus } from '../types'
import type { LoadingStage } from '../viewer-overlays'

interface UploadResult {
  urn: string
  isNewUpload: boolean
  fileName: string
}

interface UseViewerApiOptions {
  /** File to upload */
  file?: File
  /** Project ID for persistent storage (enables SHA256 caching) */
  projectId?: string
  /** Area revision ID for floor plan storage */
  areaRevisionId?: string
  /** Callback to update loading stage */
  setLoadingStage: (stage: LoadingStage) => void
  /** Callback when cache hit is detected */
  setIsCacheHit: (hit: boolean) => void
  /** Callback to update translation progress */
  setTranslationProgress: (progress: number) => void
  /** Callback to update indeterminate state */
  setIsIndeterminate: (indeterminate: boolean) => void
  /** Callback when upload completes */
  onUploadComplete?: (urn: string, isNewUpload: boolean, fileName: string) => void
  /** Callback when translation completes */
  onTranslationComplete?: (urn: string) => void
}

interface UseViewerApiReturn {
  /** Get viewer access token from API */
  getAccessToken: () => Promise<{ access_token: string; expires_in: number }>
  /** Upload file and get URN (handles caching when projectId provided) */
  uploadFile: () => Promise<string>
  /** Poll translation status until complete */
  pollTranslationStatus: (fileUrn: string, skipIfCacheHit?: boolean) => Promise<void>
}

export function useViewerApi({
  file,
  projectId,
  areaRevisionId,
  setLoadingStage,
  setIsCacheHit,
  setTranslationProgress,
  setIsIndeterminate,
  onUploadComplete,
  onTranslationComplete,
}: UseViewerApiOptions): UseViewerApiReturn {
  // Use refs for callbacks to prevent re-creation when parent re-renders
  const onUploadCompleteRef = useRef(onUploadComplete)
  const onTranslationCompleteRef = useRef(onTranslationComplete)
  useLayoutEffect(() => {
    onUploadCompleteRef.current = onUploadComplete
    onTranslationCompleteRef.current = onTranslationComplete
  }, [onUploadComplete, onTranslationComplete])

  /**
   * Get viewer token from API
   */
  const getAccessToken = useCallback(async (): Promise<{ access_token: string; expires_in: number }> => {
    const response = await fetch('/api/viewer/auth')
    if (!response.ok) {
      throw new Error('Failed to get viewer token')
    }
    return response.json()
  }, [])

  /**
   * Upload file and get URN
   * Uses planner API with persistent storage when projectId is provided
   */
  const uploadFile = useCallback(async (): Promise<string> => {
    if (!file) throw new Error('No file provided')

    setLoadingStage('upload')

    const formData = new FormData()
    formData.append('file', file)

    // Use planner API for persistent storage with caching
    // Requires both projectId and areaRevisionId
    if (projectId && areaRevisionId) {
      formData.append('projectId', projectId)
      formData.append('areaRevisionId', areaRevisionId)

      const response = await fetch('/api/planner/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json() as UploadResult & { bucketName: string }

      // Check if this was a cache hit (same file already translated)
      if (!data.isNewUpload) {
        setIsCacheHit(true)
        setLoadingStage('cache-hit')
        // Brief pause to show cache hit message
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      onUploadCompleteRef.current?.(data.urn, data.isNewUpload, data.fileName)
      return data.urn
    }

    // Fallback to transient viewer API (no caching)
    const response = await fetch('/api/viewer/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Upload failed')
    }

    const data = await response.json()
    return data.urn
  }, [file, projectId, areaRevisionId, setLoadingStage, setIsCacheHit])

  /**
   * Poll translation status until complete
   * Uses planner API when projectId is provided for consistency
   */
  const pollTranslationStatus = useCallback(async (fileUrn: string, skipIfCacheHit = false): Promise<void> => {
    // Skip translation polling if cache hit (already translated)
    if (skipIfCacheHit) {
      return
    }

    setLoadingStage('translation')

    const poll = async (): Promise<void> => {
      // Use planner status endpoint when projectId is provided
      const endpoint = projectId
        ? `/api/planner/status/${encodeURIComponent(fileUrn)}`
        : `/api/viewer/status/${encodeURIComponent(fileUrn)}`
      const response = await fetch(endpoint)
      if (!response.ok) {
        throw new Error('Failed to get translation status')
      }

      const status: TranslationStatus = await response.json()

      // Extract progress percentage from "50% complete" or similar
      const progressMatch = status.progress?.match(/(\d+)/)
      const progressValue = progressMatch ? parseInt(progressMatch[1], 10) : 0
      setTranslationProgress(progressValue)

      // APS often reports 0% for DWG→SVF2 translations throughout the process
      // Show indeterminate progress when status is inprogress but progress is 0%
      if (status.status === 'inprogress' && progressValue === 0) {
        setIsIndeterminate(true)
      } else {
        setIsIndeterminate(false)
      }

      if (status.status === 'success') {
        // Ensure progress shows 100% on completion
        setTranslationProgress(100)
        setIsIndeterminate(false)
        // Notify parent that translation is complete
        onTranslationCompleteRef.current?.(fileUrn)
        return
      }

      if (status.status === 'failed') {
        throw new Error(status.messages?.join('\n') || 'Translation failed')
      }

      await new Promise(resolve => setTimeout(resolve, 2000))
      return poll()
    }

    return poll()
  }, [projectId, setLoadingStage, setTranslationProgress, setIsIndeterminate])

  return {
    getAccessToken,
    uploadFile,
    pollTranslationStatus,
  }
}
