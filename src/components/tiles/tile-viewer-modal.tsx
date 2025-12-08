'use client'

import { useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { DwgViewer } from './dwg-viewer'

interface TileViewerModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when modal is closed */
  onOpenChange: (open: boolean) => void
  /** URN for Autodesk Viewer (preferred - faster, no re-upload) */
  viewerUrn?: string
  /** Google Drive file ID (fallback if URN not available) */
  driveFileId?: string
  /** File name for display */
  fileName: string
  /** Optional tile name for the title */
  tileName?: string
}

export function TileViewerModal({
  open,
  onOpenChange,
  viewerUrn,
  driveFileId,
  fileName,
  tileName,
}: TileViewerModalProps) {
  const handleReady = useCallback(() => {
    console.log('Viewer ready:', fileName)
  }, [fileName])

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

  // Use URN if available, otherwise fall back to driveFileId
  const hasSource = viewerUrn || driveFileId

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
            {tileName ? `${tileName} - DWG Viewer` : 'DWG Viewer'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {fileName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          {open && hasSource && (
            <DwgViewer
              urn={viewerUrn}
              driveFileId={viewerUrn ? undefined : driveFileId}
              fileName={fileName}
              theme="dark"
              onReady={handleReady}
              onError={handleError}
              className="h-full"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
