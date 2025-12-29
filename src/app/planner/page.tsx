'use client'

/**
 * Planner Page
 * Floor plan viewer with product placement functionality
 */

// Skip static generation - uses useSearchParams which requires Suspense in Next.js 16
export const dynamic = 'force-dynamic'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { FileIcon, X, FolderOpen, PanelRightClose, PanelRight, Loader2, MapPin, AlertCircle, Info, Save, ArrowLeft, ChevronDown, RefreshCw } from 'lucide-react'
import { Button } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@fossapp/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@fossapp/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@fossapp/ui'
import { cn } from '@fossapp/ui'

import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { PlannerViewer, ProductsPanel } from '@/components/planner'
import { usePlannerState } from './use-planner-state'
import { AreaCard } from './area-card'
import { ProductsGrid, FloorPlanCard, SymbolModal } from './components'
import type { AreaRevisionProduct } from '@/lib/actions/areas/revision-products-actions'
import { DeleteConfirmDialog, WarningsDialog, UnsavedChangesDialog } from './planner-dialogs'

// Loading fallback for Suspense
function PlannerLoading() {
  return (
    <ProtectedPageLayout>
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading planner...</span>
      </div>
    </ProtectedPageLayout>
  )
}

// Main planner content
function PlannerContent() {
  const state = usePlannerState()

  return (
    <ProtectedPageLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-none p-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Back button in planner mode */}
              {state.viewMode === 'planner' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={state.handleBackToOverview}
                  className="text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
              )}

              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">Planner</h1>
                <Badge variant="secondary" className="text-xs">Beta</Badge>
              </div>

              {/* Area Dropdown - only show when project has areas */}
              {state.activeProject && state.hasAreas && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Area:</span>
                  <Select
                    value={state.selectedAreaRevision?.areaId || ''}
                    onValueChange={state.handleAreaSelect}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select area" />
                    </SelectTrigger>
                    <SelectContent>
                      {state.areaRevisions.map((area) => (
                        <SelectItem key={area.areaId} value={area.areaId}>
                          <span className="font-medium">{area.areaCode}</span>
                          <span className="text-muted-foreground ml-2">{area.areaName}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Active Project Badge */}
              {state.activeProject ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Project: </span>
                    <span className="font-medium text-foreground">{state.activeProject.name}</span>
                    <span className="text-muted-foreground ml-1">({state.activeProject.project_code})</span>
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
          {!state.activeProject ? (
            /* No project selected */
            <NoProjectView />
          ) : !state.hasAreas ? (
            /* No areas in project */
            <NoAreasView projectId={state.activeProject.id} />
          ) : state.loadingAreas ? (
            /* Loading areas */
            <LoadingView message="Loading project areas..." />
          ) : state.viewMode === 'planner' && (state.selectedAreaRevision?.floorPlanUrn || state.selectedFile) ? (
            /* Planner Mode - Floor plan viewer */
            <ViewerLayout state={state} />
          ) : (
            /* Overview Mode - Floor plan card + Products grid */
            <AreaOverview state={state} />
          )}
        </div>
      </div>

      {/* Dialogs */}
      <DeleteConfirmDialog
        area={state.deleteConfirmArea}
        onOpenChange={() => state.setDeleteConfirmArea(null)}
        onConfirm={state.handleConfirmDelete}
      />

      <WarningsDialog
        area={state.warningsDialogArea}
        warnings={state.warningsData}
        isLoading={state.loadingWarnings}
        onOpenChange={() => state.setWarningsDialogArea(null)}
      />

      <UnsavedChangesDialog
        open={state.showUnsavedDialog}
        isSaving={state.isSaving}
        onOpenChange={state.setShowUnsavedDialog}
        onDiscard={() => {
          state.setShowUnsavedDialog(false)
          state.doClearFile()
        }}
        onSaveAndClose={async () => {
          await state.handleSavePlacements()
          state.setShowUnsavedDialog(false)
          state.doClearFile()
        }}
      />
    </ProtectedPageLayout>
  )
}

// ============================================================================
// Helper Views
// ============================================================================

function NoProjectView() {
  return (
    <div className="h-full p-6">
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
    </div>
  )
}

function NoAreasView({ projectId }: { projectId: string }) {
  return (
    <div className="h-full p-6">
      <div className="h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-500/30 bg-amber-500/5">
        <AlertCircle className="h-16 w-16 mx-auto mb-4 text-amber-500/50" />
        <p className="text-lg font-medium text-foreground mb-2">
          Create an area first
        </p>
        <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
          Floor plans are organized by area and revision.
          <br />
          Create at least one area in your project to upload floor plans.
        </p>
        <Link href={`/projects/${projectId}`}>
          <Button variant="default">
            <MapPin className="h-4 w-4 mr-2" />
            Go to Project Details
          </Button>
        </Link>
      </div>
    </div>
  )
}

function LoadingView({ message }: { message: string }) {
  return (
    <div className="h-full p-6">
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">{message}</span>
      </div>
    </div>
  )
}

// ============================================================================
// Area Overview - Shows floor plan card + products grid
// ============================================================================

function AreaOverview({ state }: { state: ReturnType<typeof usePlannerState> }) {
  const {
    selectedAreaRevision,
    products,
    placements,
    loadingProducts,
    refreshProducts,
    fileInputRef,
    pendingUploadAreaRef,
    handleFileChange,
    deletingAreaId,
    dragOverAreaId,
    handleCardDragOver,
    handleCardDragLeave,
    handleCardDrop,
    handleOpenPlanner,
  } = state

  // Symbol modal state
  const [symbolModalProduct, setSymbolModalProduct] = useState<AreaRevisionProduct | null>(null)
  const [symbolModalOpen, setSymbolModalOpen] = useState(false)

  const handleSymbolClick = (product: AreaRevisionProduct) => {
    setSymbolModalProduct(product)
    setSymbolModalOpen(true)
  }

  if (!selectedAreaRevision) {
    return (
      <div className="h-full p-6">
        <div className="h-full flex items-center justify-center text-muted-foreground">
          Select an area from the dropdown above
        </div>
      </div>
    )
  }

  return (
    <div className="h-full p-6 overflow-auto">
      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".dwg"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Area Header */}
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">{selectedAreaRevision.areaName}</h2>
          <Badge variant="outline" className="text-xs">
            {selectedAreaRevision.areaCode} RV{selectedAreaRevision.revisionNumber}
          </Badge>
        </div>

        {/* Floor Plan Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Floor Plan
          </h3>
          <FloorPlanCard
            area={selectedAreaRevision}
            isDeleting={deletingAreaId === selectedAreaRevision.areaId}
            isDragOver={dragOverAreaId === selectedAreaRevision.areaId}
            onUploadClick={() => {
              pendingUploadAreaRef.current = selectedAreaRevision
              fileInputRef.current?.click()
            }}
            onDeleteClick={() => state.setDeleteConfirmArea(selectedAreaRevision)}
            onWarningsClick={() => state.handleWarningsClick(
              { stopPropagation: () => {} } as React.MouseEvent,
              selectedAreaRevision
            )}
            onOpenPlanner={handleOpenPlanner}
            onDragOver={(e) => handleCardDragOver(e, selectedAreaRevision.areaId)}
            onDragLeave={handleCardDragLeave}
            onDrop={(e) => handleCardDrop(e, selectedAreaRevision)}
          />
        </div>

        {/* Products Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Products ({products.length})
            </h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={refreshProducts}
                    disabled={loadingProducts}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loadingProducts ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh products</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {loadingProducts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading products...</span>
            </div>
          ) : (
            <ProductsGrid
              products={products}
              placements={placements}
              onSymbolClick={handleSymbolClick}
            />
          )}
        </div>
      </div>

      {/* Symbol Modal */}
      <SymbolModal
        product={symbolModalProduct}
        open={symbolModalOpen}
        onOpenChange={setSymbolModalOpen}
      />
    </div>
  )
}

// ============================================================================
// Viewer Layout
// ============================================================================

function ViewerLayout({ state }: { state: ReturnType<typeof usePlannerState> }) {
  return (
    <div className="h-full flex">
      {/* Viewer Area */}
      <div className="flex-1 flex flex-col pt-6 pl-6 pb-6">
        {/* File Info Bar */}
        <FileInfoBar state={state} />

        {/* Planner Viewer */}
        <div className="flex-1 rounded-lg overflow-hidden border mr-4">
          <PlannerViewer
            file={state.selectedFile || undefined}
            urn={state.selectedUrn || undefined}
            projectId={state.activeProject?.id}
            areaRevisionId={state.selectedAreaRevision?.revisionId}
            theme="dark"
            placementMode={state.placementMode}
            initialPlacements={state.placements}
            markerMinScreenPx={state.markerMinScreenPx}
            viewerBgTopColor={state.viewerBgTopColor}
            viewerBgBottomColor={state.viewerBgBottomColor}
            reverseZoomDirection={state.reverseZoomDirection}
            onPlacementAdd={state.handlePlacementAdd}
            onPlacementDelete={state.handlePlacementDelete}
            onExitPlacementMode={state.handleExitPlacementMode}
            onReady={state.handleViewerReady}
            onUnitInfoAvailable={state.handleUnitInfoAvailable}
            onError={(error) => console.error('Viewer error:', error)}
            onUploadComplete={state.handleUploadComplete}
            onTranslationComplete={state.handleTranslationComplete}
          />
        </div>
      </div>

      {/* Products Panel */}
      <div
        className={cn(
          'flex-none border-l bg-background transition-all duration-300',
          state.isPanelCollapsed ? 'w-0 overflow-hidden' : 'w-72'
        )}
      >
        {!state.isPanelCollapsed && (
          <ProductsPanel
            products={state.products}
            placements={state.placements}
            placementMode={state.placementMode}
            onEnterPlacementMode={state.handleEnterPlacementMode}
            onExitPlacementMode={state.handleExitPlacementMode}
            className="h-full"
          />
        )}
      </div>
    </div>
  )
}

// ============================================================================
// File Info Bar
// ============================================================================

function FileInfoBar({ state }: { state: ReturnType<typeof usePlannerState> }) {
  return (
    <div className="flex-none flex items-center justify-between mb-4 mr-4 px-4 py-3 rounded-xl bg-muted/50 border">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <FileIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <p className="font-medium">
              {state.selectedFile?.name || state.selectedFileName || 'Floor Plan'}
            </p>
            {state.dwgUnitInfo && <DwgUnitInfoPopover info={state.dwgUnitInfo} />}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {state.selectedFile && (
              <span>{(state.selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
            )}
            {state.selectedAreaRevision && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {state.selectedAreaRevision.areaCode} RV{state.selectedAreaRevision.revisionNumber}
              </Badge>
            )}
            {state.selectedUrn && !state.selectedFile && (
              <span className="text-muted-foreground/70">From project storage</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Dirty indicator */}
        {state.isDirty && (
          <span className="text-xs text-amber-500 font-medium">● Unsaved</span>
        )}
        {/* Save button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={state.isDirty ? 'default' : 'ghost'}
                size="sm"
                onClick={state.handleSavePlacements}
                disabled={!state.isDirty || state.isSaving || !state.selectedAreaRevision?.revisionId}
                className={cn(
                  state.isDirty
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'text-muted-foreground'
                )}
              >
                {state.isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                Save
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{state.isDirty ? 'Save placements to database' : 'No changes to save'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="h-6 w-px bg-border mx-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => state.setIsPanelCollapsed(!state.isPanelCollapsed)}
          className="text-muted-foreground h-9 w-9"
          title={state.isPanelCollapsed ? 'Show products panel' : 'Hide products panel'}
        >
          {state.isPanelCollapsed ? (
            <PanelRight className="h-4 w-4" />
          ) : (
            <PanelRightClose className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={state.handleBackToOverview}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <X className="h-4 w-4 mr-1.5" />
          Close
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// DWG Unit Info Popover
// ============================================================================

function DwgUnitInfoPopover({ info }: { info: NonNullable<ReturnType<typeof usePlannerState>['dwgUnitInfo']> }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="p-0.5 rounded hover:bg-muted transition-colors">
          <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">DWG Unit Information</h4>
          <div className="space-y-2 text-sm">
            {info.unitString && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit String:</span>
                <span className="font-mono">{info.unitString}</span>
              </div>
            )}
            {info.displayUnit && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Display Unit:</span>
                <span className="font-mono">{info.displayUnit}</span>
              </div>
            )}
            {info.unitScale !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scale to Meters:</span>
                <span className="font-mono">{info.unitScale}</span>
              </div>
            )}
            {info.modelUnits && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model Units:</span>
                <span className="font-mono">{info.modelUnits}</span>
              </div>
            )}
            {info.pageUnits && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Page Units:</span>
                <span className="font-mono">{info.pageUnits}</span>
              </div>
            )}
            {!info.unitString && !info.displayUnit && !info.modelUnits && !info.pageUnits && (
              <p className="text-muted-foreground italic">No unit information available</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Page export - wraps content in Suspense for useSearchParams
export default function PlannerPage() {
  return (
    <Suspense fallback={<PlannerLoading />}>
      <PlannerContent />
    </Suspense>
  )
}
