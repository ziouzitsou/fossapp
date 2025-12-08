'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

// Autodesk Viewer types
declare global {
  interface Window {
    Autodesk: {
      Viewing: {
        Initializer: (options: ViewerInitOptions, callback: () => void) => void
        GuiViewer3D: new (container: HTMLElement, config?: ViewerConfig) => Viewer3D
        Document: {
          load: (
            urn: string,
            onSuccess: (doc: ViewerDocument) => void,
            onError: (errorCode: number, errorMsg: string) => void
          ) => void
        }
      }
    }
  }
}

interface ViewerInitOptions {
  env: string
  api: string
  getAccessToken: (callback: (token: string, expires: number) => void) => void
}

interface ViewerConfig {
  extensions?: string[]
}

interface Viewer3D {
  start: () => void
  finish: () => void
  loadDocumentNode: (doc: ViewerDocument, viewable: Viewable) => Promise<void>
  setTheme: (theme: 'light-theme' | 'dark-theme') => void
  resize: () => void
  container: HTMLElement
}

interface ViewerDocument {
  getRoot: () => BubbleNode
}

interface BubbleNode {
  getDefaultGeometry: () => Viewable
}

interface Viewable {
  data?: {
    guid: string
  }
}

// Status polling types
interface TranslationStatus {
  status: 'pending' | 'inprogress' | 'success' | 'failed'
  progress: string
  messages?: string[]
}

export interface DwgViewerProps {
  /** URN of the file to display (if already uploaded) */
  urn?: string
  /** Google Drive file ID to download and view */
  driveFileId?: string
  /** File name (required when using driveFileId) */
  fileName?: string
  /** File to upload (direct upload) */
  file?: File
  /** Initial theme */
  theme?: 'light' | 'dark'
  /** Callback when viewer is ready */
  onReady?: () => void
  /** Callback when error occurs */
  onError?: (error: string) => void
  /** Additional class name */
  className?: string
}

// Script loading state
let scriptsLoaded = false
let scriptsLoading = false
const loadCallbacks: Array<() => void> = []

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
  const viewerRef = useRef<Viewer3D | null>(null)
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground mb-2">{getLoadingMessage()}</p>
          {loadingStage === 'translation' && (
            <div className="w-48">
              <Progress value={translationProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center mt-1">
                DWG conversion can take 30-60 seconds
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <AlertCircle className="h-8 w-8 text-destructive mb-4" />
          <p className="text-sm text-destructive text-center max-w-md px-4">{error}</p>
        </div>
      )}

    </div>
  )
}
