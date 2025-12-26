'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@fossapp/ui'
import { DwgViewer } from '@/components/tiles/dwg-viewer'

interface PlaygroundViewerModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when modal is closed */
  onOpenChange: (open: boolean) => void
  /** URN for Autodesk Viewer (preferred - faster, no re-upload) */
  viewerUrn?: string
  /** Job ID to fetch the DWG file from (fallback if URN not available) */
  jobId?: string
  /** File name for display */
  fileName?: string
}

export function PlaygroundViewerModal({
  open,
  onOpenChange,
  viewerUrn,
  jobId,
  fileName = 'Playground.dwg',
}: PlaygroundViewerModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Only fetch file if we don't have a URN (fallback mode)
  useEffect(() => {
    if (!open || viewerUrn || !jobId) {
      setFile(null)
      setFetchError(null)
      return
    }

    let mounted = true

    const fetchFile = async () => {
      try {
        const response = await fetch(`/api/playground/download/${jobId}`)
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to fetch DWG file')
        }

        const blob = await response.blob()
        const dwgFile = new File([blob], fileName, {
          type: 'application/octet-stream',
        })

        if (mounted) {
          setFile(dwgFile)
          setFetchError(null)
        }
      } catch (err) {
        if (mounted) {
          setFetchError(err instanceof Error ? err.message : 'Failed to fetch DWG file')
        }
      }
    }

    fetchFile()

    return () => {
      mounted = false
    }
  }, [open, viewerUrn, jobId, fileName])

  const handleReady = useCallback(() => {
    console.log('Playground viewer ready')
  }, [])

  const handleError = useCallback((error: string) => {
    console.error('Viewer error:', error)
  }, [])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Determine if we have a valid source
  const hasSource = viewerUrn || file

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => {
          e.preventDefault()
          onOpenChange(false)
        }}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <DialogTitle className="text-base">
            Playground - DWG Viewer
          </DialogTitle>
          <DialogDescription className="text-xs">
            {fileName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          {open && hasSource && !fetchError && (
            <DwgViewer
              urn={viewerUrn}
              file={viewerUrn ? undefined : file ?? undefined}
              theme="dark"
              onReady={handleReady}
              onError={handleError}
              className="h-full"
            />
          )}

          {fetchError && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-destructive">{fetchError}</p>
            </div>
          )}

          {open && !hasSource && !fetchError && !viewerUrn && jobId && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">Loading DWG file...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
