'use client'

/**
 * Planner Page
 * Floor plan viewer with product placement functionality
 */

// Skip static generation - uses useSearchParams which requires Suspense in Next.js 16
export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import Link from 'next/link'
import { FolderOpen, Loader2, ArrowLeft } from 'lucide-react'
import { Button, Badge } from '@fossapp/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@fossapp/ui'

import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { usePlannerState } from './use-planner-state'
import {
  AreaOverview,
  ViewerLayout,
  NoProjectView,
  NoAreasView,
  LoadingView,
} from './components'
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
            <NoProjectView />
          ) : !state.hasAreas ? (
            <NoAreasView projectId={state.activeProject.id} />
          ) : state.loadingAreas ? (
            <LoadingView message="Loading project areas..." />
          ) : state.viewMode === 'planner' && (state.selectedAreaRevision?.floorPlanUrn || state.selectedFile) ? (
            <ViewerLayout state={state} />
          ) : (
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

// Page export - wraps content in Suspense for useSearchParams
export default function PlannerPage() {
  return (
    <Suspense fallback={<PlannerLoading />}>
      <PlannerContent />
    </Suspense>
  )
}
