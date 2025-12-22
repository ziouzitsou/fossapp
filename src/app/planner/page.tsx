'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { useActiveProject } from '@/lib/active-project-context'
import { PlannerViewer, ProductsPanel } from '@/components/planner'
import type { Viewer3DInstance, Placement, PlacementModeProduct } from '@/components/planner'

import { FileIcon, X, FolderOpen, PanelRightClose, PanelRight, Loader2, MapPin, AlertCircle, Plus, Trash2, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import { listProjectAreasAction, listAreaVersionProductsAction, deleteAreaVersionFloorPlanAction, type AreaVersionProduct } from '@/lib/actions/project-areas'

// Type for area-version selection
interface AreaVersionOption {
  areaId: string
  areaCode: string
  areaName: string
  versionId: string
  versionNumber: number
  floorPlanUrn?: string
  floorPlanFilename?: string
  floorPlanStatus?: string
  floorPlanWarnings?: number
}

export default function PlannerPage() {
  const { activeProject } = useActiveProject()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedUrn, setSelectedUrn] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [dragOverAreaId, setDragOverAreaId] = useState<string | null>(null)
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)

  // Area-version selection
  const [areaVersions, setAreaVersions] = useState<AreaVersionOption[]>([])
  const [selectedAreaVersion, setSelectedAreaVersion] = useState<AreaVersionOption | null>(null)
  const [loadingAreas, setLoadingAreas] = useState(false)

  // Pending upload area - tracks which area a file input belongs to
  const [pendingUploadArea, setPendingUploadArea] = useState<AreaVersionOption | null>(null)

  // Deletion state
  const [deletingAreaId, setDeletingAreaId] = useState<string | null>(null)
  const [deleteConfirmArea, setDeleteConfirmArea] = useState<AreaVersionOption | null>(null)

  // Warnings dialog state
  const [warningsDialogArea, setWarningsDialogArea] = useState<AreaVersionOption | null>(null)
  const [warningsData, setWarningsData] = useState<Array<{ code: string; message: string }> | null>(null)
  const [loadingWarnings, setLoadingWarnings] = useState(false)

  // Viewer reference
  const viewerRef = useRef<Viewer3DInstance | null>(null)

  // Area version products
  const [products, setProducts] = useState<AreaVersionProduct[]>([])
  const [_loadingProducts, setLoadingProducts] = useState(false)

  // Placements state (local for now, DB later)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)

  // Placement mode state - which product is being placed
  const [placementMode, setPlacementMode] = useState<PlacementModeProduct | null>(null)

  // Load project areas when active project changes
  useEffect(() => {
    async function loadAreas() {
      if (!activeProject?.id) {
        setAreaVersions([])
        setSelectedAreaVersion(null)
        return
      }

      setLoadingAreas(true)
      try {
        const result = await listProjectAreasAction(activeProject.id, true) // Include versions
        if (result.success && result.data) {
          // Map areas to area-version options (using current version)
          const options: AreaVersionOption[] = result.data
            .filter(area => area.current_version_data?.id) // Only areas with version data
            .map(area => ({
              areaId: area.id,
              areaCode: area.area_code,
              areaName: area.area_name,
              versionId: area.current_version_data!.id,
              versionNumber: area.current_version,
              floorPlanUrn: area.current_version_data!.floor_plan_urn,
              floorPlanFilename: area.current_version_data!.floor_plan_filename,
              floorPlanStatus: area.current_version_data!.floor_plan_status,
              floorPlanWarnings: area.current_version_data!.floor_plan_warnings
            }))

          setAreaVersions(options)

          // Auto-select first area if available
          if (options.length > 0 && !selectedAreaVersion) {
            setSelectedAreaVersion(options[0])
          }

          // Check for stale "inprogress" translations and update their status
          const inProgressAreas = options.filter(av => av.floorPlanStatus === 'inprogress')
          if (inProgressAreas.length > 0) {
            // Check each inprogress area's manifest (in parallel)
            const manifestUpdates = await Promise.all(
              inProgressAreas.map(async (area) => {
                try {
                  const res = await fetch(`/api/planner/manifest?areaVersionId=${area.versionId}`)
                  if (res.ok) {
                    const manifest = await res.json()
                    if (manifest.status === 'success' || manifest.status === 'failed') {
                      return {
                        versionId: area.versionId,
                        status: manifest.status,
                        warnings: manifest.warningCount || 0
                      }
                    }
                  }
                } catch (err) {
                  console.error(`Failed to check manifest for ${area.areaCode}:`, err)
                }
                return null
              })
            )

            // Update local state with any completed translations
            const completedUpdates = manifestUpdates.filter(Boolean)
            if (completedUpdates.length > 0) {
              setAreaVersions(prev =>
                prev.map(av => {
                  const update = completedUpdates.find(u => u?.versionId === av.versionId)
                  if (update) {
                    return {
                      ...av,
                      floorPlanStatus: update.status,
                      floorPlanWarnings: update.warnings
                    }
                  }
                  return av
                })
              )
            }
          }
        } else {
          setAreaVersions([])
          setSelectedAreaVersion(null)
        }
      } catch (err) {
        console.error('Failed to load project areas:', err)
        setAreaVersions([])
        setSelectedAreaVersion(null)
      } finally {
        setLoadingAreas(false)
      }
    }

    loadAreas()
  }, [activeProject?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load products for selected area version
  useEffect(() => {
    async function loadProducts() {
      if (!selectedAreaVersion?.versionId) {
        setProducts([])
        return
      }

      setLoadingProducts(true)
      try {
        const result = await listAreaVersionProductsAction(selectedAreaVersion.versionId)
        if (result.success && result.data) {
          setProducts(result.data)
        } else {
          setProducts([])
        }
      } catch (err) {
        console.error('Failed to load area version products:', err)
        setProducts([])
      } finally {
        setLoadingProducts(false)
      }
    }

    loadProducts()
  }, [selectedAreaVersion?.versionId])

  // Update viewer when area-version changes
  useEffect(() => {
    setSelectedFile(null)
    // Set URN from selected area (don't clear - this caused double-click bug)
    setSelectedUrn(selectedAreaVersion?.floorPlanUrn || null)
    setSelectedFileName(selectedAreaVersion?.floorPlanFilename || null)
    setPlacements([])
    setSelectedPlacementId(null)
    viewerRef.current = null
  }, [selectedAreaVersion?.versionId, selectedAreaVersion?.floorPlanUrn, selectedAreaVersion?.floorPlanFilename])

  // Clear placements when file changes
  useEffect(() => {
    setPlacements([])
    setSelectedPlacementId(null)
  }, [selectedFile])

  // Per-card drag handlers
  const handleCardDragOver = useCallback((e: React.DragEvent, areaId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setDragOverAreaId(areaId)
    }
  }, [])

  const handleCardDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverAreaId(null)
  }, [])

  const handleCardDrop = useCallback((e: React.DragEvent, area: AreaVersionOption) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverAreaId(null)

    const files = Array.from(e.dataTransfer.files)
    const dwgFile = files.find(f => f.name.toLowerCase().endsWith('.dwg'))

    if (dwgFile) {
      // Set the area for this file upload
      setSelectedAreaVersion(area)
      setSelectedFile(dwgFile)
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.name.toLowerCase().endsWith('.dwg') && pendingUploadArea) {
      setSelectedAreaVersion(pendingUploadArea)
      setSelectedFile(file)
    }
    // Reset input and pending area
    e.target.value = ''
    setPendingUploadArea(null)
  }, [pendingUploadArea])

  const clearFile = useCallback(() => {
    setSelectedFile(null)
    setSelectedUrn(null)
    setSelectedFileName(null)
    setPlacements([])
    setSelectedPlacementId(null)
    viewerRef.current = null
  }, [])

  // Handle clicking on an area card with existing DWG
  const handleAreaCardClick = useCallback((area: AreaVersionOption) => {
    if (area.floorPlanUrn) {
      // Area has a floor plan - select it (useEffect will set URN)
      setSelectedAreaVersion(area)
    } else {
      // Area has no floor plan - open file picker
      setPendingUploadArea(area)
      document.getElementById('dwg-upload')?.click()
    }
  }, [])

  // Handle clicking delete button - opens confirmation dialog
  const handleDeleteClick = useCallback((e: React.MouseEvent, area: AreaVersionOption) => {
    e.stopPropagation() // Prevent card click
    if (!area.floorPlanUrn) return
    setDeleteConfirmArea(area)
  }, [])

  // Handle confirming deletion from dialog
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmArea) return

    setDeletingAreaId(deleteConfirmArea.areaId)
    setDeleteConfirmArea(null) // Close dialog immediately

    try {
      const result = await deleteAreaVersionFloorPlanAction(deleteConfirmArea.versionId)
      if (result.success) {
        // Update local state to remove floor plan info
        setAreaVersions(prev =>
          prev.map(av =>
            av.versionId === deleteConfirmArea.versionId
              ? { ...av, floorPlanUrn: undefined, floorPlanFilename: undefined }
              : av
          )
        )
      } else {
        alert(result.error || 'Failed to delete floor plan')
      }
    } catch (err) {
      console.error('Delete floor plan error:', err)
      alert('Failed to delete floor plan')
    } finally {
      setDeletingAreaId(null)
    }
  }, [deleteConfirmArea])

  // Handle clicking warnings badge - opens warnings dialog
  const handleWarningsClick = useCallback(async (e: React.MouseEvent, area: AreaVersionOption) => {
    e.stopPropagation() // Prevent card click

    setWarningsDialogArea(area)
    setWarningsData(null)
    setLoadingWarnings(true)

    try {
      const res = await fetch(`/api/planner/manifest?areaVersionId=${area.versionId}`)
      if (res.ok) {
        const manifest = await res.json()
        setWarningsData(manifest.warnings || [])
      } else {
        setWarningsData([])
      }
    } catch (err) {
      console.error('Failed to fetch warnings:', err)
      setWarningsData([])
    } finally {
      setLoadingWarnings(false)
    }
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

  const _handlePlacementSelect = useCallback((id: string | null) => {
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

  // Determine if we have areas
  const hasAreas = areaVersions.length > 0

  return (
    <ProtectedPageLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-none p-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">Planner</h1>
              <Badge variant="secondary" className="text-xs">Beta</Badge>
            </div>

            <div className="flex items-center gap-3">
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
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {!selectedFile && !selectedUrn ? (
            /* File Upload Area */
            <div className="h-full p-6">
              {!activeProject ? (
                /* No Project Selected */
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
              ) : loadingAreas ? (
                /* Loading Areas */
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-muted-foreground">Loading project areas...</span>
                </div>
              ) : !hasAreas ? (
                /* No Areas - Block with prompt */
                <div className="h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-500/30 bg-amber-500/5">
                  <AlertCircle className="h-16 w-16 mx-auto mb-4 text-amber-500/50" />
                  <p className="text-lg font-medium text-foreground mb-2">
                    Create an area first
                  </p>
                  <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                    Floor plans are organized by area and version.
                    <br />
                    Create at least one area in your project to upload floor plans.
                  </p>
                  <Link href={`/projects/${activeProject.id}`}>
                    <Button variant="default">
                      <MapPin className="h-4 w-4 mr-2" />
                      Go to Project Details
                    </Button>
                  </Link>
                </div>
              ) : hasAreas ? (
                /* Area Cards Grid */
                <div className="h-full flex flex-col">
                  {/* Hidden file input */}
                  <input
                    type="file"
                    accept=".dwg"
                    onChange={handleFileChange}
                    className="hidden"
                    id="dwg-upload"
                  />

                  {/* Area Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {areaVersions.map((area) => {
                      const hasFloorPlan = !!area.floorPlanUrn
                      const isDragOver = dragOverAreaId === area.areaId

                      return (
                        <div
                          key={area.versionId}
                          onClick={() => handleAreaCardClick(area)}
                          onDragOver={(e) => !hasFloorPlan && handleCardDragOver(e, area.areaId)}
                          onDragLeave={handleCardDragLeave}
                          onDrop={(e) => !hasFloorPlan && handleCardDrop(e, area)}
                          className={cn(
                            'relative p-4 rounded-xl border-2 cursor-pointer transition-all',
                            hasFloorPlan
                              ? 'bg-card hover:bg-accent border-border hover:border-primary/50'
                              : isDragOver
                                ? 'bg-primary/10 border-primary border-dashed'
                                : 'bg-muted/30 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/50'
                          )}
                        >
                          {/* Area Header */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{area.areaCode}</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  v{area.versionNumber}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate mt-0.5">
                                {area.areaName}
                              </p>
                            </div>
                          </div>

                          {/* Content based on floor plan status */}
                          {hasFloorPlan ? (
                            <div className="flex items-center gap-3">
                              {/* Thumbnail or fallback icon */}
                              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted overflow-hidden relative">
                                {area.floorPlanStatus === 'success' ? (
                                  <Image
                                    src={`/api/planner/thumbnail?areaVersionId=${area.versionId}`}
                                    alt={area.floorPlanFilename || 'Floor plan thumbnail'}
                                    fill
                                    className="object-cover pointer-events-none"
                                    unoptimized
                                  />
                                ) : area.floorPlanStatus === 'inprogress' ? (
                                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                  </div>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                    <FileIcon className="h-5 w-5 text-primary" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium truncate">
                                    {area.floorPlanFilename || 'Floor Plan'}
                                  </p>
                                  {/* Warning badge - clickable to show details */}
                                  {area.floorPlanWarnings && area.floorPlanWarnings > 0 && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            onClick={(e) => handleWarningsClick(e, area)}
                                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors cursor-pointer"
                                          >
                                            <AlertTriangle className="h-3 w-3" />
                                            <span className="text-[10px] font-medium">{area.floorPlanWarnings}</span>
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Click to view {area.floorPlanWarnings} warning{area.floorPlanWarnings > 1 ? 's' : ''}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {area.floorPlanStatus === 'inprogress' ? 'Processing...' : 'Click to open'}
                                </p>
                              </div>
                              {/* Delete button */}
                              <button
                                onClick={(e) => handleDeleteClick(e, area)}
                                disabled={deletingAreaId === area.areaId}
                                className={cn(
                                  'flex-shrink-0 p-2 rounded-lg transition-colors',
                                  'hover:bg-destructive/10 hover:text-destructive',
                                  'text-muted-foreground',
                                  deletingAreaId === area.areaId && 'opacity-50 cursor-not-allowed'
                                )}
                                title="Delete floor plan"
                              >
                                {deletingAreaId === area.areaId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                                isDragOver ? 'bg-primary/20' : 'bg-muted'
                              )}>
                                <Plus className={cn(
                                  'h-5 w-5',
                                  isDragOver ? 'text-primary' : 'text-muted-foreground'
                                )} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={cn(
                                  'text-sm font-medium',
                                  isDragOver ? 'text-primary' : 'text-muted-foreground'
                                )}>
                                  {isDragOver ? 'Drop to upload' : 'Upload DWG'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Click or drop file
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
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
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {selectedFile && (
                          <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                        )}
                        {selectedAreaVersion && (
                          <span>• {selectedAreaVersion.areaCode} v{selectedAreaVersion.versionNumber}</span>
                        )}
                        {selectedUrn && !selectedFile && (
                          <span>• From project storage</span>
                        )}
                      </div>
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
                    areaVersionId={selectedAreaVersion?.versionId}
                    theme="dark"
                    placementMode={placementMode}
                    onPlacementAdd={handlePlacementAdd}
                    onPlacementDelete={handlePlacementDelete}
                    onExitPlacementMode={handleExitPlacementMode}
                    onReady={handleViewerReady}
                    onError={(error) => console.error('Viewer error:', error)}
                    onUploadComplete={(urn, isNewUpload, fileName) => {
                      console.log('Upload complete:', { urn: urn.substring(0, 20) + '...', isNewUpload, fileName })
                      // Update local state with new floor plan info
                      if (selectedAreaVersion) {
                        setAreaVersions(prev =>
                          prev.map(av =>
                            av.versionId === selectedAreaVersion.versionId
                              ? {
                                  ...av,
                                  floorPlanUrn: urn,
                                  floorPlanFilename: fileName,
                                  floorPlanStatus: isNewUpload ? 'inprogress' : 'success'
                                }
                              : av
                          )
                        )
                      }
                    }}
                    onTranslationComplete={async () => {
                      // Fetch manifest to update DB and get warnings/thumbnail
                      if (selectedAreaVersion) {
                        try {
                          const res = await fetch(`/api/planner/manifest?areaVersionId=${selectedAreaVersion.versionId}`)
                          if (res.ok) {
                            const manifest = await res.json()
                            // Update local state with success status and warnings
                            setAreaVersions(prev =>
                              prev.map(av =>
                                av.versionId === selectedAreaVersion.versionId
                                  ? {
                                      ...av,
                                      floorPlanStatus: 'success',
                                      floorPlanWarnings: manifest.warningCount || 0
                                    }
                                  : av
                              )
                            )
                          }
                        } catch (err) {
                          console.error('Failed to fetch manifest:', err)
                        }
                      }
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmArea} onOpenChange={(open) => !open && setDeleteConfirmArea(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Floor Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the floor plan from <strong>{deleteConfirmArea?.areaCode}</strong>?
              {deleteConfirmArea?.floorPlanFilename && (
                <span className="block mt-2 text-sm">
                  File: <span className="font-mono text-foreground/80">{deleteConfirmArea.floorPlanFilename}</span>
                </span>
              )}
              <span className="block mt-2 text-muted-foreground">
                This will delete the DWG file from storage. You can upload a new one anytime.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Translation Warnings Dialog */}
      <Dialog open={!!warningsDialogArea} onOpenChange={(open) => !open && setWarningsDialogArea(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Translation Warnings
            </DialogTitle>
            <DialogDescription>
              {warningsDialogArea?.areaCode} - {warningsDialogArea?.floorPlanFilename}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {loadingWarnings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : warningsData && warningsData.length > 0 ? (
              warningsData.map((warning, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
                >
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                        {warning.code}
                      </p>
                      <p className="text-sm text-foreground/80">
                        {warning.message || 'No additional details available'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No warning details available</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            These warnings are from Autodesk&apos;s translation service. They typically indicate minor issues
            that may affect how certain elements are displayed.
          </p>
        </DialogContent>
      </Dialog>
    </ProtectedPageLayout>
  )
}
