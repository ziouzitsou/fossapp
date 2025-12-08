'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, AlertTriangle, RefreshCw, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { DWGViewer } from '@/components/tiles/dwg-viewer'
import { Progress } from '@/components/ui/progress'

interface PlaygroundViewerModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
}

type ViewerState = 'idle' | 'uploading' | 'translating' | 'ready' | 'error'

export function PlaygroundViewerModal({
  isOpen,
  onClose,
  jobId
}: PlaygroundViewerModalProps) {
  const [viewerState, setViewerState] = useState<ViewerState>('idle')
  const [urn, setUrn] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  // Prepare viewer when modal opens
  const prepareViewer = useCallback(async () => {
    if (!isOpen || !jobId) return

    setViewerState('uploading')
    setError(null)
    setProgress(10)

    try {
      // Download the DWG from our job endpoint
      const downloadResponse = await fetch(`/api/playground/download/${jobId}`)
      if (!downloadResponse.ok) {
        throw new Error('Failed to fetch DWG from job')
      }

      const blob = await downloadResponse.blob()
      setProgress(30)

      // Upload to APS viewer
      const formData = new FormData()
      formData.append('file', new File([blob], 'Playground.dwg', { type: 'application/octet-stream' }))

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

      setUrn(newUrn)
      setViewerState('ready')

    } catch (err) {
      console.error('Viewer preparation failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to prepare viewer')
      setViewerState('error')
    }
  }, [isOpen, jobId])

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
      <div className="relative w-full max-w-6xl h-[85vh] mx-4 bg-background rounded-lg shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">Playground.dwg</h2>
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
              onClick={toggleTheme}
              title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative">
          {/* Loading states */}
          {(viewerState === 'uploading' || viewerState === 'translating') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-sm font-medium mb-2">
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
              <Button variant="outline" onClick={prepareViewer}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            </div>
          )}

          {/* Viewer */}
          {viewerState === 'ready' && urn && (
            <DWGViewer urn={urn} className="h-full" />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t bg-muted/50">
          <p className="text-xs text-muted-foreground text-center">
            View-only mode • Download the DWG to edit in AutoCAD
          </p>
        </div>
      </div>
    </div>
  )
}
