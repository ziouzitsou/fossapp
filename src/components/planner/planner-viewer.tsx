'use client'

/**
 * PlannerViewer - Dedicated APS Viewer for the Planner feature
 *
 * Uses Viewer3D (no built-in GUI) with custom external toolbar controls.
 * This allows full control over the UI layout and styling.
 *
 * Features:
 * - Custom toolbar outside the WebGL canvas
 * - Click-to-place products
 * - Coordinate conversion (screen to world)
 * - Clean integration with our React UI
 * - PERSISTENT storage with SHA256 caching (same file = instant load)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, AlertCircle, Maximize, Home, CheckCircle2, Ruler, Trash2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Viewer3DInstance, WorldCoordinates as WorldCoordsType, ViewerInitOptions } from '@/types/autodesk-viewer'

// Re-export the Viewer3DInstance type for consumers
export type { Viewer3DInstance }

// Status polling types
interface TranslationStatus {
  status: 'pending' | 'inprogress' | 'success' | 'failed'
  progress: string
  messages?: string[]
}

// World coordinates for planner placements (re-export from shared types)
export type WorldCoordinates = WorldCoordsType

// Navigation tool modes
export type ViewerTool = 'pan' | 'orbit' | 'zoom' | 'select'

export interface PlannerViewerProps {
  /** File to upload and view */
  file?: File
  /** URN of already uploaded file */
  urn?: string
  /** Project ID for persistent storage and caching (uses planner API) */
  projectId?: string
  /** Initial theme */
  theme?: 'light' | 'dark'
  /** Callback when viewer is ready */
  onReady?: (viewer: Viewer3DInstance) => void
  /** Callback when error occurs */
  onError?: (error: string) => void
  /** Callback when user clicks on the viewer (for placing products) */
  onViewerClick?: (worldCoords: WorldCoordinates | null, screenCoords: { x: number; y: number }) => void
  /** Callback when upload completes (with cache info) */
  onUploadComplete?: (urn: string, isNewUpload: boolean) => void
  /** Additional class name */
  className?: string
}

// Script loading state (module-level singleton)
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

    // Load CSS (minimal - we're not using their GUI)
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

export function PlannerViewer({
  file,
  urn: initialUrn,
  projectId,
  theme: initialTheme = 'dark',
  onReady,
  onError,
  onViewerClick,
  onUploadComplete,
  className,
}: PlannerViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer3DInstance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStage, setLoadingStage] = useState<'scripts' | 'upload' | 'translation' | 'viewer' | 'cache-hit'>('scripts')
  const [translationProgress, setTranslationProgress] = useState(0)
  const [isIndeterminate, setIsIndeterminate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urn, setUrn] = useState<string | undefined>(initialUrn)
  const [isCacheHit, setIsCacheHit] = useState(false)
  const [isMeasuring, setIsMeasuring] = useState(false)
  const [hasMeasurement, setHasMeasurement] = useState(false)

  // Get viewer token from API
  const getAccessToken = useCallback(async (): Promise<{ access_token: string; expires_in: number }> => {
    const response = await fetch('/api/viewer/auth')
    if (!response.ok) {
      throw new Error('Failed to get viewer token')
    }
    return response.json()
  }, [])

  // Upload file and get URN
  // Uses planner API with persistent storage when projectId is provided
  const uploadFile = useCallback(async (): Promise<string> => {
    if (!file) throw new Error('No file provided')

    setLoadingStage('upload')

    const formData = new FormData()
    formData.append('file', file)

    // Use planner API for persistent storage with caching
    if (projectId) {
      formData.append('projectId', projectId)

      const response = await fetch('/api/planner/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json() as {
        urn: string
        isNewUpload: boolean
        bucketName: string
        fileName: string
      }

      // Check if this was a cache hit (same file already translated)
      if (!data.isNewUpload) {
        setIsCacheHit(true)
        setLoadingStage('cache-hit')
        // Brief pause to show cache hit message
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      onUploadComplete?.(data.urn, data.isNewUpload)
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
  }, [file, projectId, onUploadComplete])

  // Poll translation status
  // Uses planner API when projectId is provided for consistency
  const pollTranslationStatus = useCallback(async (fileUrn: string): Promise<void> => {
    // Skip translation polling if cache hit (already translated)
    if (isCacheHit) {
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
        return
      }

      if (status.status === 'failed') {
        throw new Error(status.messages?.join('\n') || 'Translation failed')
      }

      await new Promise(resolve => setTimeout(resolve, 2000))
      return poll()
    }

    return poll()
  }, [isCacheHit, projectId])

  // Initialize viewer with Viewer3D (no GUI)
  const initializeViewer = useCallback(async (fileUrn: string): Promise<void> => {
    if (!containerRef.current) return

    setLoadingStage('viewer')

    const tokenData = await getAccessToken()

    return new Promise((resolve, reject) => {
      const options: ViewerInitOptions = {
        env: 'AutodeskProduction2',
        api: 'streamingV2_EU',
        getAccessToken: (callback) => {
          callback(tokenData.access_token, tokenData.expires_in)
        },
      }

      window.Autodesk.Viewing.Initializer(options, () => {
        if (!containerRef.current) {
          reject(new Error('Container not found'))
          return
        }

        // Use Viewer3D instead of GuiViewer3D - no built-in toolbar!
        const viewer = new window.Autodesk.Viewing.Viewer3D(containerRef.current, {
          extensions: ['Autodesk.Measure'],
        })

        viewer.start()
        viewer.setTheme(initialTheme === 'dark' ? 'dark-theme' : 'light-theme')
        viewerRef.current = viewer

        // Set default navigation behavior
        viewer.navigation.setZoomTowardsPivot(true)

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
              // Activate pan tool by default (mouse wheel zooms, drag pans)
              viewer.toolController.activateTool('pan')
              setIsLoading(false)
              onReady?.(viewer)
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
        setLoadingStage('scripts')
        await loadAutodeskScripts()

        if (!mounted) return

        let fileUrn = urn

        if (!fileUrn && file) {
          fileUrn = await uploadFile()
          if (!mounted) return
          setUrn(fileUrn)
        }

        if (!fileUrn) {
          throw new Error('No URN available')
        }

        await pollTranslationStatus(fileUrn)
        if (!mounted) return

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
  }, [urn, file, uploadFile, pollTranslationStatus, initializeViewer, onError])

  // Handle click events for placing products
  useEffect(() => {
    if (!onViewerClick || !viewerRef.current) return

    const container = containerRef.current
    if (!container) return

    const handleClick = (e: MouseEvent) => {
      const viewer = viewerRef.current
      if (!viewer) return

      const rect = container.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top

      let worldCoords: WorldCoordinates | null = null
      if (viewer.clientToWorld) {
        const result = viewer.clientToWorld(e.clientX, e.clientY)
        if (result) {
          worldCoords = { x: result.x, y: result.y, z: result.z }
        }
      }

      onViewerClick(worldCoords, { x: screenX, y: screenY })
    }

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [onViewerClick])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      viewerRef.current?.resize()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Prevent wheel events from propagating
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const preventScroll = (e: WheelEvent) => {
      e.stopPropagation()
    }

    container.addEventListener('wheel', preventScroll, { passive: false })
    return () => container.removeEventListener('wheel', preventScroll)
  }, [])

  // Toolbar actions
  const handleFitToView = useCallback(() => {
    viewerRef.current?.fitToView()
  }, [])

  const handleToggleMeasure = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const measureExt = viewer.getExtension('Autodesk.Measure') as any
    if (!measureExt) return

    if (isMeasuring) {
      measureExt.deactivate()
      setIsMeasuring(false)
    } else {
      measureExt.activate('distance')
      setIsMeasuring(true)
    }
  }, [isMeasuring])

  const handleClearMeasurements = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const measureExt = viewer.getExtension('Autodesk.Measure') as any
    if (!measureExt) return

    // Clear all measurements
    measureExt.deleteCurrentMeasurement()
    setHasMeasurement(false)
  }, [])

  // Poll for measurements while in measure mode
  useEffect(() => {
    if (!isMeasuring) {
      return
    }

    const viewer = viewerRef.current
    if (!viewer) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const measureExt = viewer.getExtension('Autodesk.Measure') as any
    if (!measureExt) return

    const checkForMeasurements = () => {
      const measureTool = measureExt.measureTool
      if (measureTool) {
        // Check if there's a current measurement
        const hasMeasure = measureTool._currentMeasurement != null ||
                          (measureTool._measurementsManager?.getMeasurementList?.()?.length > 0)
        setHasMeasurement(hasMeasure)
      }
    }

    // Check periodically while measuring
    const interval = setInterval(checkForMeasurements, 500)

    return () => clearInterval(interval)
  }, [isMeasuring])

  const getLoadingMessage = () => {
    switch (loadingStage) {
      case 'scripts':
        return 'Loading viewer...'
      case 'upload':
        return projectId ? 'Uploading to persistent storage...' : 'Uploading floor plan...'
      case 'cache-hit':
        return 'Using cached translation...'
      case 'translation':
        // Show percentage only if APS provides real progress, otherwise just "Converting..."
        return isIndeterminate
          ? 'Converting DWG...'
          : `Converting DWG (${translationProgress}%)...`
      case 'viewer':
        return 'Initializing viewer...'
      default:
        return 'Loading...'
    }
  }

  const showToolbar = !isLoading && !error

  return (
    <div className={cn('relative w-full h-full flex flex-col', className)}>
      {/* Viewer container - takes remaining space */}
      <div className="flex-1 relative">
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{
            background: initialTheme === 'dark' ? '#1a1a1a' : '#f0f0f0',
          }}
        />

        {/* Loading overlay */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            {loadingStage === 'cache-hit' ? (
              <CheckCircle2 className="h-8 w-8 text-green-500 mb-4" />
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            )}
            <p className="text-sm text-muted-foreground mb-2">{getLoadingMessage()}</p>
            {loadingStage === 'cache-hit' && (
              <p className="text-xs text-green-600">
                Same file detected - no re-translation needed!
              </p>
            )}
            {loadingStage === 'translation' && (
              <div className="w-48">
                {isIndeterminate ? (
                  /* Indeterminate progress bar - sliding animation */
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden relative">
                    <div className="absolute h-full w-1/3 bg-primary rounded-full animate-slide" />
                  </div>
                ) : (
                  <Progress value={translationProgress} className="h-2" />
                )}
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

      {/* Custom Toolbar - OUTSIDE the canvas */}
      {showToolbar && (
        <div className="flex-none border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-center gap-1 p-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isMeasuring ? 'default' : 'ghost'}
                  size="sm"
                  onClick={handleToggleMeasure}
                >
                  <Ruler className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Measure Distance</TooltipContent>
            </Tooltip>

            {hasMeasurement && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearMeasurements}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear Measurement</TooltipContent>
              </Tooltip>
            )}

            <div className="w-px h-6 bg-border mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFitToView}
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fit to View</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFitToView}
                >
                  <Home className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Home</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  )
}
