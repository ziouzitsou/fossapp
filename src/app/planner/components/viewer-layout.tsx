'use client'

/**
 * Viewer Layout Component
 * Layout for the floor plan viewer mode with side panel
 */

import { cn } from '@fossapp/ui'
import { PlannerViewer, ProductsPanel } from '@/components/planner'
import { FileInfoBar } from './file-info-bar'
import type { PlannerState } from '../types'

interface ViewerLayoutProps {
  state: PlannerState
}

export function ViewerLayout({ state }: ViewerLayoutProps) {
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
