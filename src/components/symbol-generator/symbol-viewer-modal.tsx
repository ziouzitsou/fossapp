'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DwgViewer } from '@/components/tiles/dwg-viewer'
import { Image as ImageIcon, FileText } from 'lucide-react'

interface SymbolViewerModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when modal is closed */
  onOpenChange: (open: boolean) => void
  /** URN for Autodesk Viewer */
  viewerUrn?: string
  /** Job ID to fetch files from */
  jobId?: string
  /** Product ID for display */
  fossPid?: string
  /** Whether PNG is available */
  hasPng?: boolean
}

export function SymbolViewerModal({
  open,
  onOpenChange,
  viewerUrn,
  jobId,
  fossPid = 'Symbol',
  hasPng = false,
}: SymbolViewerModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [pngUrl, setPngUrl] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('dwg')

  // Fetch DWG file if no URN (fallback mode)
  useEffect(() => {
    if (!open || viewerUrn || !jobId) {
      setFile(null)
      setFetchError(null)
      return
    }

    let mounted = true

    const fetchFile = async () => {
      try {
        const response = await fetch(`/api/symbol-generator/download/${jobId}?type=dwg`)
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to fetch DWG file')
        }

        const blob = await response.blob()
        const dwgFile = new File([blob], `${fossPid}_Symbol.dwg`, {
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
  }, [open, viewerUrn, jobId, fossPid])

  // Fetch PNG URL
  useEffect(() => {
    if (!open || !jobId || !hasPng) {
      setPngUrl(null)
      return
    }

    // Create object URL for PNG preview
    let objectUrl: string | null = null

    const fetchPng = async () => {
      try {
        const response = await fetch(`/api/symbol-generator/download/${jobId}?type=png`)
        if (response.ok) {
          const blob = await response.blob()
          objectUrl = URL.createObjectURL(blob)
          setPngUrl(objectUrl)
        }
      } catch {
        // PNG is optional, ignore errors
      }
    }

    fetchPng()

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [open, jobId, hasPng])

  const handleReady = useCallback(() => {
    console.log('Symbol viewer ready')
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
            Symbol Preview - {fossPid}
          </DialogTitle>
          <DialogDescription className="text-xs">
            View the generated symbol
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          {hasPng ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="border-b px-4">
                <TabsList className="h-9">
                  <TabsTrigger value="dwg" className="gap-1.5 text-xs">
                    <FileText className="h-3.5 w-3.5" />
                    DWG Viewer
                  </TabsTrigger>
                  <TabsTrigger value="png" className="gap-1.5 text-xs">
                    <ImageIcon className="h-3.5 w-3.5" />
                    PNG Preview
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="dwg" className="flex-1 m-0 overflow-hidden">
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
              </TabsContent>

              <TabsContent value="png" className="flex-1 m-0 overflow-hidden">
                {pngUrl ? (
                  <div className="h-full w-full flex items-center justify-center bg-zinc-900 p-4">
                    <img
                      src={pngUrl}
                      alt={`${fossPid} Symbol`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Loading PNG...</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            // No PNG - just show DWG viewer
            <>
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
