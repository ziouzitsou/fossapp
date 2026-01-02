/**
 * DWG Viewer - Autodesk Forge Viewer integration for displaying CAD files
 *
 * Provides an embedded 3D viewer for DWG files using Autodesk's Forge platform.
 * Supports multiple input sources:
 * - **URN**: Pre-uploaded file (immediate viewing)
 * - **driveFileId**: Download from Google Drive, upload to APS, then view
 * - **file**: Direct file upload from browser
 *
 * @remarks
 * The viewer goes through several loading stages:
 * 1. Load Autodesk viewer scripts (~1-2s)
 * 2. Upload file to APS if needed (~3-5s)
 * 3. Wait for translation (DWG → viewable format, 30-60s)
 * 4. Initialize viewer and load model
 *
 * Uses the EMEA region endpoint (streamingV2_EU) to match our APS setup.
 *
 * @see {@link https://aps.autodesk.com/en/docs/viewer/v7/} Autodesk Viewer docs
 */
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Progress } from '@fossapp/ui'
import { cn } from '@fossapp/ui'
import type { GuiViewer3DInstance, ViewerInitOptions } from '@/types/autodesk-viewer'

/** APS translation job status returned by the status polling API. */
interface TranslationStatus {
  status: 'pending' | 'inprogress' | 'success' | 'failed'
  progress: string
  messages?: string[]
}

/**
 * Props for the DwgViewer component.
 * Provide exactly one of: `urn`, `driveFileId` + `fileName`, or `file`.
 */
export interface DwgViewerProps {
  /** URN of a file already uploaded to APS (base64-encoded object ID) */
  urn?: string
  /** Google Drive file ID - will download and upload to APS for viewing */
  driveFileId?: string
  /** File name (required when using driveFileId for proper MIME detection) */
  fileName?: string
  /** Direct file upload from browser file input */
  file?: File
  /** Viewer theme, matches app theme by default */
  theme?: 'light' | 'dark'
  /** Called when the model is fully loaded and ready to interact */
  onReady?: () => void
  /** Called when any error occurs during loading stages */
  onError?: (error: string) => void
  /** Additional CSS class for the container */
  className?: string
}

// Script loading state (module-level singleton for deduplication)
let scriptsLoaded = false
let scriptsLoading = false
const loadCallbacks: Array<() => void> = []

/**
 * Dynamically loads the Autodesk Viewer scripts and CSS.
 * Uses singleton pattern to prevent duplicate loading across component instances.
 */
function loadAutodeskScripts(): Promise<void> {
  return new Promise((resolve) => {
    if (scriptsLoaded) {
      resolve()
      return
    }

    if (scriptsLoading) {
      loadCallbacks.push(resolve)
      return
    }

    scriptsLoading = true

    // Load CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css'
    document.head.appendChild(link)

    // Load JS
    const script = document.createElement('script')
    script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js'
    script.onload = () => {
      scriptsLoaded = true
      scriptsLoading = false
      resolve()
      loadCallbacks.forEach(cb => cb())
      loadCallbacks.length = 0
    }
    script.onerror = () => {
      scriptsLoading = false
      console.error('Failed to load Autodesk Viewer scripts')
    }
    document.head.appendChild(script)
  })
}

/**
 * Embedded Autodesk Forge Viewer for displaying DWG and other CAD files.
 *
 * @remarks
 * Displays loading progress with stage indicators and handles
 * wheel event capture to prevent page scrolling when zooming the model.
 */
export function DwgViewer({
  urn: initialUrn,
  driveFileId,
  fileName,
  file,
  theme: initialTheme = 'dark',
  onReady,
  onError,
  className,
}: DwgViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<GuiViewer3DInstance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStage, setLoadingStage] = useState<'scripts' | 'upload' | 'translation' | 'viewer'>('scripts')
  const [translationProgress, setTranslationProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [urn, setUrn] = useState<string | undefined>(initialUrn)

  // Get viewer token from API
  const getAccessToken = useCallback(async (): Promise<{ access_token: string; expires_in: number }> => {
    const response = await fetch('/api/viewer/auth')
    if (!response.ok) {
      throw new Error('Failed to get viewer token')
    }
    return response.json()
  }, [])

  // Upload file and get URN
  const uploadFile = useCallback(async (): Promise<string> => {
    setLoadingStage('upload')

    const formData = new FormData()

    if (file) {
      formData.append('file', file)
    } else if (driveFileId && fileName) {
      formData.append('driveFileId', driveFileId)
      formData.append('fileName', fileName)
    } else {
      throw new Error('No file or driveFileId provided')
    }

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
  }, [file, driveFileId, fileName])

  // Poll translation status
  const pollTranslationStatus = useCallback(async (fileUrn: string): Promise<void> => {
    setLoadingStage('translation')

    const poll = async (): Promise<void> => {
      const response = await fetch(`/api/viewer/status/${encodeURIComponent(fileUrn)}`)
      if (!response.ok) {
        throw new Error('Failed to get translation status')
      }

      const status: TranslationStatus = await response.json()

      // Parse progress percentage
      const progressMatch = status.progress?.match(/(\d+)/)
      if (progressMatch) {
        setTranslationProgress(parseInt(progressMatch[1], 10))
      }

      if (status.status === 'success') {
        return
      }

      if (status.status === 'failed') {
        throw new Error(status.messages?.join('\n') || 'Translation failed')
      }

      // Continue polling
      await new Promise(resolve => setTimeout(resolve, 2000))
      return poll()
    }

    return poll()
  }, [])

  // Initialize viewer
  const initializeViewer = useCallback(async (fileUrn: string): Promise<void> => {
    if (!containerRef.current) return

    setLoadingStage('viewer')

    const tokenData = await getAccessToken()

    return new Promise((resolve, reject) => {
      const options: ViewerInitOptions = {
        env: 'AutodeskProduction2',
        api: 'streamingV2_EU', // EMEA region to match model translation endpoint
        getAccessToken: (callback) => {
          callback(tokenData.access_token, tokenData.expires_in)
        },
      }

      window.Autodesk.Viewing.Initializer(options, () => {
        if (!containerRef.current) {
          reject(new Error('Container not found'))
          return
        }

        const viewer = new window.Autodesk.Viewing.GuiViewer3D(containerRef.current, {
          extensions: ['Autodesk.DocumentBrowser'],
        })

        viewer.start()
        viewer.setTheme(initialTheme === 'dark' ? 'dark-theme' : 'light-theme')
        viewerRef.current = viewer

        // Load the document
        const documentId = `urn:${fileUrn}`
        window.Autodesk.Viewing.Document.load(
          documentId,
          async (doc) => {
            const viewable = doc.getRoot().getDefaultGeometry()
            if (!viewable) {
              reject(new Error('No viewable geometry found'))
              return
            }

            try {
              await viewer.loadDocumentNode(doc, viewable)
              setIsLoading(false)
              onReady?.()
              resolve()
            } catch (err) {
              reject(err)
            }
          },
          (errorCode, errorMsg) => {
            reject(new Error(`Document load failed: ${errorMsg} (${errorCode})`))
          }
        )
      })
    })
  }, [getAccessToken, initialTheme, onReady])

  // Main initialization effect
  useEffect(() => {
    let mounted = true
    let cleanup: (() => void) | undefined

    const initialize = async () => {
      try {
        // Load Autodesk scripts
        setLoadingStage('scripts')
        await loadAutodeskScripts()

        if (!mounted) return

        let fileUrn = urn

        // Upload file if needed
        if (!fileUrn && (file || driveFileId)) {
          fileUrn = await uploadFile()
          if (!mounted) return
          setUrn(fileUrn)
        }

        if (!fileUrn) {
          throw new Error('No URN available')
        }

        // Poll translation status
        await pollTranslationStatus(fileUrn)
        if (!mounted) return

        // Initialize viewer
        await initializeViewer(fileUrn)

        cleanup = () => {
          if (viewerRef.current) {
            viewerRef.current.finish()
            viewerRef.current = null
          }
        }
      } catch (err) {
        if (!mounted) return
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        setIsLoading(false)
        onError?.(errorMessage)
      }
    }

    initialize()

    return () => {
      mounted = false
      cleanup?.()
    }
  }, [urn, file, driveFileId, uploadFile, pollTranslationStatus, initializeViewer, onError])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      viewerRef.current?.resize()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Prevent wheel events from propagating to parent (prevents page scroll behind modal)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const preventScroll = (e: WheelEvent) => {
      e.stopPropagation()
    }

    container.addEventListener('wheel', preventScroll, { passive: false })
    return () => container.removeEventListener('wheel', preventScroll)
  }, [])

  const getLoadingMessage = () => {
    switch (loadingStage) {
      case 'scripts':
        return 'Loading viewer...'
      case 'upload':
        return 'Uploading file...'
      case 'translation':
        return `Converting DWG (${translationProgress}%)...`
      case 'viewer':
        return 'Initializing viewer...'
      default:
        return 'Loading...'
    }
  }

  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* Viewer container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{
          background: initialTheme === 'dark' ? '#1a1a1a' : '#f0f0f0',
        }}
      />

      {/* Loading overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground mb-2">{getLoadingMessage()}</p>
          {loadingStage === 'translation' && (
            <div className="w-48">
              <Progress value={translationProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center mt-1">
                DWG conversion can take 30-60 seconds.
                <br />
                <span className="text-amber-500">Please do not close this window.</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs z-10">
          <AlertCircle className="h-8 w-8 text-destructive mb-4" />
          <p className="text-sm text-destructive text-center max-w-md px-4">{error}</p>
        </div>
      )}

    </div>
  )
}
