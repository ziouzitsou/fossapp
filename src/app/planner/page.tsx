'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { useActiveProject } from '@/lib/active-project-context'
import { PlannerViewer, ProductsPanel } from '@/components/planner'
import type { Viewer3DInstance, Placement, PlacementModeProduct } from '@/components/planner'

import { Upload, FileIcon, X, FolderOpen, PanelRightClose, PanelRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { getProjectByIdAction, type ProjectProduct } from '@/lib/actions/projects'

// Type for existing DWG files in OSS
interface ExistingDWG {
  fileName: string
  objectKey: string
  size: number
  uploadedAt: string
  urn: string
}

export default function PlannerPage() {
  const { activeProject } = useActiveProject()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedUrn, setSelectedUrn] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)

  // Existing DWGs in OSS
  const [existingDWGs, setExistingDWGs] = useState<ExistingDWG[]>([])
  const [loadingDWGs, setLoadingDWGs] = useState(false)

  // Viewer reference
  const viewerRef = useRef<Viewer3DInstance | null>(null)

  // Project products
  const [products, setProducts] = useState<ProjectProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Placements state (local for now, DB later)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)

  // Placement mode state - which product is being placed
  const [placementMode, setPlacementMode] = useState<PlacementModeProduct | null>(null)

  // Load project products when active project changes
  useEffect(() => {
    async function loadProducts() {
      if (!activeProject?.id) {
        setProducts([])
        return
      }

      setLoadingProducts(true)
      try {
        const project = await getProjectByIdAction(activeProject.id)
        if (project?.products) {
          setProducts(project.products)
        } else {
          setProducts([])
        }
      } catch (err) {
        console.error('Failed to load project products:', err)
        setProducts([])
      } finally {
        setLoadingProducts(false)
      }
    }

    loadProducts()
  }, [activeProject?.id])

  // Load existing DWGs from OSS when project changes
  useEffect(() => {
    async function loadExistingDWGs() {
      if (!activeProject?.id) {
        setExistingDWGs([])
        return
      }

      setLoadingDWGs(true)
      try {
        const response = await fetch(`/api/planner/files?projectId=${activeProject.id}`)
        if (response.ok) {
          const data = await response.json()
          setExistingDWGs(data.files || [])
        } else {
          setExistingDWGs([])
        }
      } catch (err) {
        console.error('Failed to load existing DWGs:', err)
        setExistingDWGs([])
      } finally {
        setLoadingDWGs(false)
      }
    }

    loadExistingDWGs()
  }, [activeProject?.id])

  // Clear placements when file changes
  useEffect(() => {
    setPlacements([])
    setSelectedPlacementId(null)
  }, [selectedFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // Only set drag over for file drops, not product drops
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true)
    }
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
    setSelectedUrn(null)
    setSelectedFileName(null)
    setPlacements([])
    setSelectedPlacementId(null)
    viewerRef.current = null
  }, [])

  // Select an existing DWG from OSS - uses pre-derived URN
  const handleSelectExistingDWG = useCallback((dwg: ExistingDWG) => {
    setSelectedUrn(dwg.urn)
    setSelectedFileName(dwg.fileName)
    setSelectedFile(null)
  }, [])

  // Viewer ready callback
  const handleViewerReady = useCallback((viewer: Viewer3DInstance) => {
    viewerRef.current = viewer
  }, [])

  // Counter for generating unique dbIds (DataVisualization sprites need numeric IDs)
  const dbIdCounterRef = useRef(1000) // Start at 1000 to avoid conflicts with model dbIds

  // Placement handlers
  const handlePlacementAdd = useCallback((placement: Omit<Placement, 'dbId'>) => {
    console.log('[PlannerPage] handlePlacementAdd called:', placement)
    const newPlacement: Placement = {
      ...placement,
      dbId: dbIdCounterRef.current++,
    }
    setPlacements(prev => {
      console.log('[PlannerPage] Updating placements:', prev.length, '->', prev.length + 1)
      return [...prev, newPlacement]
    })
    setSelectedPlacementId(newPlacement.id)
  }, [])

  const handlePlacementSelect = useCallback((id: string | null) => {
    setSelectedPlacementId(id)
  }, [])

  const handlePlacementDelete = useCallback((id: string) => {
    setPlacements(prev => prev.filter(p => p.id !== id))
    if (selectedPlacementId === id) {
      setSelectedPlacementId(null)
    }
  }, [selectedPlacementId])

  // Enter placement mode - user clicked on a product to place
  const handleEnterPlacementMode = useCallback((product: PlacementModeProduct) => {
    setPlacementMode(product)
    setSelectedPlacementId(null) // Deselect any selected placement
  }, [])

  // Exit placement mode - ESC pressed or placement completed
  const handleExitPlacementMode = useCallback(() => {
    setPlacementMode(null)
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
        <div className="flex-1 overflow-hidden">
          {!selectedFile && !selectedUrn ? (
            /* File Upload Area */
            <div className="h-full p-6">
              {activeProject ? (
                <div className="h-full flex flex-col gap-4">
                  {/* Existing DWGs List */}
                  {loadingDWGs ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading floor plans...</span>
                    </div>
                  ) : existingDWGs.length > 0 ? (
                    <div className="flex-none">
                      <h3 className="text-sm font-medium text-foreground mb-2">Existing Floor Plans</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {existingDWGs.map((dwg) => (
                          <button
                            key={dwg.objectKey}
                            onClick={() => handleSelectExistingDWG(dwg)}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                          >
                            <FileIcon className="h-8 w-8 text-primary flex-none" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{dwg.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {(dwg.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Upload Area */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      'flex-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
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
                    <div className="text-center">
                      <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-base font-medium text-foreground mb-1">
                        {existingDWGs.length > 0 ? 'Upload another DWG' : 'Drop your DWG file here'}
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">
                        or click to browse
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          document.getElementById('dwg-upload')?.click()
                        }}
                      >
                        Select DWG File
                      </Button>
                    </div>
                    {isDragOver && (
                      <p className="mt-3 text-sm text-primary font-medium">
                        Drop to upload
                      </p>
                    )}
                  </div>
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
              )}
            </div>
          ) : (
            /* Viewer + Products Panel Layout */
            <div className="h-full flex">
              {/* Viewer Area */}
              <div className="flex-1 flex flex-col p-6 pr-0">
                {/* File Info Bar */}
                <div className="flex-none flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-3">
                    <FileIcon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">
                        {selectedFile?.name || selectedFileName || 'Floor Plan'}
                      </p>
                      {selectedFile && (
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      )}
                      {selectedUrn && !selectedFile && (
                        <p className="text-xs text-muted-foreground">
                          From project storage
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                      className="text-muted-foreground"
                    >
                      {isPanelCollapsed ? (
                        <PanelRight className="h-4 w-4" />
                      ) : (
                        <PanelRightClose className="h-4 w-4" />
                      )}
                    </Button>
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
                </div>

                {/* Planner Viewer */}
                <div className="flex-1 rounded-lg overflow-hidden border">
                  <PlannerViewer
                    file={selectedFile || undefined}
                    urn={selectedUrn || undefined}
                    projectId={activeProject?.id}
                    theme="dark"
                    placementMode={placementMode}
                    onPlacementAdd={handlePlacementAdd}
                    onPlacementDelete={handlePlacementDelete}
                    onExitPlacementMode={handleExitPlacementMode}
                    onReady={handleViewerReady}
                    onError={(error) => console.error('Viewer error:', error)}
                    onUploadComplete={(urn, isNewUpload) => {
                      console.log('Upload complete:', { urn: urn.substring(0, 20) + '...', isNewUpload })
                    }}
                  />
                </div>
              </div>

              {/* Products Panel */}
              <div
                className={cn(
                  'flex-none border-l bg-background transition-all duration-300',
                  isPanelCollapsed ? 'w-0 overflow-hidden' : 'w-72'
                )}
              >
                {!isPanelCollapsed && (
                  <ProductsPanel
                    products={products}
                    placements={placements}
                    placementMode={placementMode}
                    onEnterPlacementMode={handleEnterPlacementMode}
                    onExitPlacementMode={handleExitPlacementMode}
                    className="h-full"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedPageLayout>
  )
}
