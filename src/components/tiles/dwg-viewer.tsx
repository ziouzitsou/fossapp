'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Loader2 } from 'lucide-react'

// Declare Autodesk types for TypeScript
declare global {
  interface Window {
    Autodesk: typeof Autodesk
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Autodesk {
    namespace Viewing {
      function Initializer(
        options: {
          env: string
          api?: string
          getAccessToken: (callback: (token: string, expires: number) => void) => void
        },
        callback: () => void
      ): void

      class GuiViewer3D {
        constructor(container: HTMLElement, config?: object)
        start(): void
        finish(): void
        setTheme(theme: string): void
        setLightPreset(preset: number): void
        prefs: {
          set(name: string, value: boolean | number | string): void
          get(name: string): boolean | number | string
        }
        loadDocumentNode(doc: Document, node: unknown): Promise<unknown>
        loadExtension(extensionId: string, options?: object): Promise<unknown>
      }

      class Document {
        static load(
          urn: string,
          onSuccess: (doc: Document) => void,
          onFailure: (code: number, message: string, errors: unknown[]) => void
        ): void
        getRoot(): {
          getDefaultGeometry(): unknown
        }
      }
    }
  }
}

interface DWGViewerProps {
  urn: string | null
  className?: string
}

/**
 * Simplified DWG Viewer component for viewing tiles
 * View-only - no markup or annotation features
 */
export function DWGViewer({ urn, className }: DWGViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Autodesk.Viewing.GuiViewer3D | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isScriptsLoaded, setIsScriptsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  // Apply theme to viewer
  // Uses 'swapBlackAndWhite' preference for 2D sheet color (like AutoCAD's "2D Sheet Color" setting)
  const applyViewerTheme = useCallback((viewer: Autodesk.Viewing.GuiViewer3D, isDark: boolean) => {
    viewer.setTheme(isDark ? 'dark-theme' : 'light-theme')
    // swapBlackAndWhite: true = dark background (inverts colors), false = light background
    viewer.prefs.set('swapBlackAndWhite', isDark)
  }, [])

  // Load Autodesk Viewer scripts
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.Autodesk?.Viewing) {
      setIsScriptsLoaded(true)
      return
    }

    const loadScripts = async () => {
      // Load CSS
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css'
      document.head.appendChild(link)

      // Load JS
      const script = document.createElement('script')
      script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js'
      script.async = true
      script.onload = () => {
        setIsScriptsLoaded(true)
      }
      script.onerror = () => {
        setError('Failed to load Autodesk Viewer scripts')
      }
      document.head.appendChild(script)
    }

    loadScripts()
  }, [])

  // Get access token for viewer
  const getAccessToken = useCallback(async (callback: (token: string, expires: number) => void) => {
    try {
      const response = await fetch('/api/viewer/auth')
      if (!response.ok) {
        throw new Error('Failed to get access token')
      }
      const { access_token, expires_in } = await response.json()
      callback(access_token, expires_in)
    } catch (err) {
      console.error('Failed to get access token:', err)
      setError('Failed to authenticate with Autodesk')
    }
  }, [])

  // Initialize viewer
  const initViewer = useCallback((): Promise<Autodesk.Viewing.GuiViewer3D> | undefined => {
    if (!containerRef.current || !window.Autodesk?.Viewing) return undefined

    const isDark = resolvedTheme === 'dark'

    return new Promise<Autodesk.Viewing.GuiViewer3D>((resolve) => {
      window.Autodesk.Viewing.Initializer(
        {
          env: 'AutodeskProduction2',
          api: 'streamingV2',
          getAccessToken
        },
        async () => {
          const config = {
            extensions: ['Autodesk.DocumentBrowser']
          }
          const viewer = new window.Autodesk.Viewing.GuiViewer3D(containerRef.current!, config)
          viewer.start()
          applyViewerTheme(viewer, isDark)
          viewerRef.current = viewer

          resolve(viewer)
        }
      )
    })
  }, [getAccessToken, resolvedTheme, applyViewerTheme])

  // Load model by URN
  const loadModel = useCallback(async (viewer: Autodesk.Viewing.GuiViewer3D, modelUrn: string) => {
    return new Promise<void>((resolve, reject) => {
      viewer.setLightPreset(0)
      window.Autodesk.Viewing.Document.load(
        'urn:' + modelUrn,
        async (doc) => {
          const viewable = doc.getRoot().getDefaultGeometry()
          try {
            await viewer.loadDocumentNode(doc, viewable)
            resolve()
          } catch (err) {
            reject(err)
          }
        },
        (code, message, errors) => {
          reject(new Error(`Document load failed: ${message} (code: ${code})`))
          console.error('Load errors:', errors)
        }
      )
    })
  }, [])

  // Handle URN changes
  useEffect(() => {
    if (!isScriptsLoaded || !urn || !containerRef.current) return

    const loadViewer = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Initialize viewer if not already done
        let viewer = viewerRef.current
        if (!viewer) {
          const newViewer = await initViewer()
          if (!newViewer) {
            throw new Error('Failed to initialize viewer')
          }
          viewer = newViewer
        }

        // Load the model
        await loadModel(viewer, urn)
      } catch (err) {
        console.error('Viewer error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load model')
      } finally {
        setIsLoading(false)
      }
    }

    loadViewer()
  }, [urn, isScriptsLoaded, initViewer, loadModel])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.finish()
        viewerRef.current = null
      }
    }
  }, [])

  // Update viewer theme when user toggles theme
  useEffect(() => {
    if (viewerRef.current && resolvedTheme) {
      applyViewerTheme(viewerRef.current, resolvedTheme === 'dark')
    }
  }, [resolvedTheme, applyViewerTheme])

  return (
    <div className={`relative ${className || ''}`}>
      <div
        ref={containerRef}
        className="w-full h-full min-h-[500px] bg-muted rounded-lg overflow-hidden"
      />

      {/* Loading overlay */}
      {(isLoading || (!isScriptsLoaded && urn)) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {!isScriptsLoaded ? 'Loading viewer...' : 'Loading drawing...'}
            </p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <div className="text-center p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}

      {/* Placeholder when no URN */}
      {!urn && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            No drawing to display
          </p>
        </div>
      )}
    </div>
  )
}
