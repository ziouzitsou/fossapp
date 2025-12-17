'use client'

import { useState, useCallback } from 'react'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { useActiveProject } from '@/lib/active-project-context'
import { PlannerViewer } from '@/components/planner/planner-viewer'
import { Upload, FileIcon, X, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function PlannerPage() {
  const { activeProject } = useActiveProject()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const dwgFile = files.find(f => f.name.toLowerCase().endsWith('.dwg'))

    if (dwgFile) {
      setSelectedFile(dwgFile)
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.name.toLowerCase().endsWith('.dwg')) {
      setSelectedFile(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [])

  const clearFile = useCallback(() => {
    setSelectedFile(null)
  }, [])

  return (
    <ProtectedPageLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-none p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Planner</h1>
              <p className="text-muted-foreground mt-1">
                Upload a floor plan DWG to start planning
              </p>
            </div>

            {/* Active Project Badge */}
            {activeProject ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <FolderOpen className="h-4 w-4 text-primary" />
                <div className="text-sm">
                  <span className="text-muted-foreground">Project: </span>
                  <span className="font-medium text-foreground">{activeProject.name}</span>
                  <span className="text-muted-foreground ml-1">({activeProject.project_code})</span>
                </div>
              </div>
            ) : (
              <Link href="/projects">
                <Button variant="outline" size="sm">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Select a Project
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-hidden">
          {!selectedFile ? (
            /* File Upload Area */
            activeProject ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors cursor-pointer',
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                )}
              >
                <input
                  type="file"
                  accept=".dwg"
                  onChange={handleFileChange}
                  className="hidden"
                  id="dwg-upload"
                />
                <label htmlFor="dwg-upload" className="cursor-pointer text-center">
                  <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-lg font-medium text-foreground mb-2">
                    Drop your DWG file here
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    or click to browse
                  </p>
                  <Button variant="outline" asChild>
                    <span>Select DWG File</span>
                  </Button>
                </label>
                {isDragOver && (
                  <p className="mt-4 text-sm text-primary font-medium">
                    Drop to upload
                  </p>
                )}
              </div>
            ) : (
              /* No Project Selected - Disabled State */
              <div className="h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30">
                <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  Please select a project first
                </p>
                <p className="text-sm text-muted-foreground/70 mb-4 text-center max-w-md">
                  Floor plans are saved to your project for persistent storage.
                  <br />
                  The same file won&apos;t need re-translation next time.
                </p>
                <Link href="/projects">
                  <Button variant="default">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Go to Projects
                  </Button>
                </Link>
              </div>
            )
          ) : (
            /* Viewer Area */
            <div className="h-full flex flex-col">
              {/* File Info Bar */}
              <div className="flex-none flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-3">
                  <FileIcon className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Close
                </Button>
              </div>

              {/* Planner Viewer */}
              <div className="flex-1 rounded-lg overflow-hidden border">
                <PlannerViewer
                  file={selectedFile}
                  projectId={activeProject?.id}
                  theme="dark"
                  onReady={(viewer) => console.log('Planner viewer ready', viewer)}
                  onError={(error) => console.error('Viewer error:', error)}
                  onViewerClick={(worldCoords, screenCoords) => {
                    console.log('Viewer clicked:', { worldCoords, screenCoords })
                  }}
                  onUploadComplete={(urn, isNewUpload) => {
                    console.log('Upload complete:', { urn: urn.substring(0, 20) + '...', isNewUpload })
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedPageLayout>
  )
}
