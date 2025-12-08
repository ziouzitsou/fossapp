'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { X, Loader2, AlertTriangle, ExternalLink, RefreshCw, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DWGViewer } from './dwg-viewer'
import { Progress } from '@/components/ui/progress'

// localStorage key for viewer cache
const VIEWER_CACHE_KEY = 'tiles-viewer-cache'

// Cache entry structure
interface ViewerCacheEntry {
  urn: string
  expiresAt: number
  fileName: string
}

// Cache structure
interface ViewerCache {
  [tileId: string]: ViewerCacheEntry
}

// Get cache from localStorage
function getViewerCache(): ViewerCache {
  if (typeof window === 'undefined') return {}
  try {
    const cached = localStorage.getItem(VIEWER_CACHE_KEY)
    return cached ? JSON.parse(cached) : {}
  } catch {
    return {}
  }
}

// Save cache to localStorage
function saveViewerCache(cache: ViewerCache): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(VIEWER_CACHE_KEY, JSON.stringify(cache))
  } catch (e) {
    console.warn('Failed to save viewer cache:', e)
  }
}

// Get cached entry for a tile
function getCachedViewer(tileId: string): ViewerCacheEntry | null {
  const cache = getViewerCache()
  const entry = cache[tileId]
  if (!entry) return null

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    // Remove expired entry
    delete cache[tileId]
    saveViewerCache(cache)
    return null
  }

  return entry
}

// Save viewer entry to cache
function cacheViewer(tileId: string, entry: ViewerCacheEntry): void {
  const cache = getViewerCache()
  cache[tileId] = entry
  saveViewerCache(cache)
}

interface TileViewerModalProps {
  isOpen: boolean
  onClose: () => void
  tileId: string
  tileName: string
  dwgFileId: string // Google Drive file ID for the DWG
  driveLink?: string // Link to Google Drive TILES folder
  onRegenerateTile?: () => void
}

type ViewerState = 'idle' | 'checking' | 'uploading' | 'translating' | 'ready' | 'expired' | 'error'

export function TileViewerModal({
  isOpen,
  onClose,
  tileId,
  tileName,
  dwgFileId,
  driveLink,
  onRegenerateTile
}: TileViewerModalProps) {
  const [viewerState, setViewerState] = useState<ViewerState>('idle')
  const [urn, setUrn] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  // Google Drive TILES folder link
  const tilesFolderLink = 'https://drive.google.com/drive/folders/1h0Mc0K0e0e0e0e0e0e0e0e0e0e0e0e0' // Replace with actual folder ID

  // Check cache and prepare viewer when modal opens
  const prepareViewer = useCallback(async () => {
    if (!isOpen || !dwgFileId) return

    setViewerState('checking')
    setError(null)
    setProgress(0)

    // Check cache first
    const cached = getCachedViewer(tileId)
    if (cached) {
      console.log('Using cached URN for tile:', tileId)
      setUrn(cached.urn)
      setViewerState('ready')
      return
    }

    // No cache - need to upload and translate
    try {
      // Send Drive file ID to server (server downloads from Google Drive)
      setViewerState('uploading')
      setProgress(10)

      const formData = new FormData()
      formData.append('driveFileId', dwgFileId)
      formData.append('fileName', `${tileName}.dwg`)

      const uploadResponse = await fetch('/api/viewer/upload', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error || 'Failed to upload for viewing')
      }

      const { urn: newUrn } = await uploadResponse.json()
      setProgress(50)

      // Poll for translation status
      setViewerState('translating')

      let translationComplete = false
      let attempts = 0
      const maxAttempts = 60 // 2 minutes max

      while (!translationComplete && attempts < maxAttempts) {
        const statusResponse = await fetch(`/api/viewer/status/${encodeURIComponent(newUrn)}`)
        if (!statusResponse.ok) {
          throw new Error('Failed to check translation status')
        }

        const status = await statusResponse.json()
        console.log('Translation status:', status)

        if (status.status === 'success' || status.status === 'complete') {
          translationComplete = true
          setProgress(100)
        } else if (status.status === 'failed') {
          throw new Error(status.messages?.join(', ') || 'Translation failed')
        } else {
          // Parse progress percentage
          const progressMatch = status.progress?.match(/(\d+)/)
          if (progressMatch) {
            const translationProgress = parseInt(progressMatch[1], 10)
            setProgress(50 + (translationProgress / 2)) // 50-100%
          }

          await new Promise(resolve => setTimeout(resolve, 2000))
          attempts++
        }
      }

      if (!translationComplete) {
        throw new Error('Translation timed out')
      }

      // Cache the URN (expires in 24 hours)
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000
      cacheViewer(tileId, { urn: newUrn, expiresAt, fileName: `${tileName}.dwg` })

      setUrn(newUrn)
      setViewerState('ready')

    } catch (err) {
      console.error('Viewer preparation failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to prepare viewer')
      setViewerState('error')
    }
  }, [isOpen, dwgFileId, tileId, tileName])

  // Prepare viewer when modal opens
  useEffect(() => {
    if (isOpen) {
      prepareViewer()
    } else {
      // Reset state when modal closes
      setViewerState('idle')
      setUrn(null)
      setProgress(0)
      setError(null)
    }
  }, [isOpen, prepareViewer])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-6xl h-[85vh] mx-4 bg-background rounded-lg shadow-xl flex flex-col overflow-hidden z-[51]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - must be above viewer which creates high z-index elements */}
        <div className="flex items-center justify-between px-4 py-3 border-b relative z-[1000] bg-background">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">{tileName}.dwg</h2>
            {viewerState === 'ready' && (
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                View-only
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Theme toggle for viewer */}
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                toggleTheme()
              }}
              title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            {driveLink && (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={driveLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open in Drive
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onClose()
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content - viewer container with contained stacking context */}
        <div className="flex-1 relative z-0 isolate">
          {/* Loading states */}
          {(viewerState === 'checking' || viewerState === 'uploading' || viewerState === 'translating') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-sm font-medium mb-2">
                {viewerState === 'checking' && 'Checking viewer cache...'}
                {viewerState === 'uploading' && 'Preparing drawing for viewing...'}
                {viewerState === 'translating' && 'Converting to web format...'}
              </p>
              <div className="w-64">
                <Progress value={progress} className="h-2" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {viewerState === 'translating' && 'This may take 30-60 seconds'}
              </p>
            </div>
          )}

          {/* Error state */}
          {viewerState === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
              <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
              <p className="text-sm font-medium text-destructive mb-2">Failed to load viewer</p>
              <p className="text-xs text-muted-foreground mb-4 max-w-md text-center">{error}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={prepareViewer}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
                {driveLink && (
                  <Button variant="outline" asChild>
                    <a href={driveLink} target="_blank" rel="noopener noreferrer">
                      Open in Google Drive
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Expired state */}
          {viewerState === 'expired' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
              <AlertTriangle className="h-10 w-10 text-amber-500 mb-4" />
              <p className="text-sm font-medium mb-2">Viewer session expired</p>
              <p className="text-xs text-muted-foreground mb-4 max-w-md text-center">
                The web viewer cache has expired (24 hours). You can regenerate the tile to view it again, or access the DWG file directly from Google Drive.
              </p>
              <div className="flex gap-2">
                {onRegenerateTile && (
                  <Button onClick={onRegenerateTile}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Regenerate Tile
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <a
                    href={driveLink || tilesFolderLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open in Google Drive
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* Viewer */}
          {viewerState === 'ready' && urn && (
            <DWGViewer urn={urn} className="h-full" />
          )}
        </div>

        {/* Footer - above viewer */}
        <div className="px-4 py-2 border-t bg-muted/50 relative z-[1000]">
          <p className="text-xs text-muted-foreground text-center">
            View-only mode • To edit, open the DWG file from Google Drive with AutoCAD
          </p>
        </div>
      </div>
    </div>
  )
}
