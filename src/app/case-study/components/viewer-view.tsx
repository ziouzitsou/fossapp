'use client'

import { Card, CardContent } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { ScrollArea } from '@fossapp/ui'
import { Plus, Upload } from 'lucide-react'
import { cn } from '@fossapp/ui'
import { PlannerViewer } from '@/components/planner'
import type { LuminaireProduct, Placement, ViewerCoordinates } from '../types'
import type { ViewerControlsValue, FloorPlanUploadValue } from '../hooks'

interface ViewerViewProps {
  luminaires: LuminaireProduct[]
  placements: Placement[]
  viewerControls: ViewerControlsValue
  floorPlanUpload: FloorPlanUploadValue
  projectId: string | null
  areaRevisionId: string | null
  /** Viewer background top color (hex) */
  viewerBgTopColor?: string
  /** Viewer background bottom color (hex) */
  viewerBgBottomColor?: string
  /** Minimum marker size in pixels */
  markerMinScreenPx?: number
  /** Reverse mouse wheel zoom direction */
  reverseZoomDirection?: boolean
  onAddPlacement: (
    projectProductId: string,
    symbol: string,
    coords: ViewerCoordinates,
    rotation?: number
  ) => Placement | null
  onRemovePlacement: (placementId: string) => void
}

/**
 * Viewer View - DWG canvas with pick-and-place functionality
 *
 * Left side: DWG viewer canvas (placeholder for Phase 4)
 * Right side: Products panel for placement selection
 * Bottom: Status bar with coordinates and placement mode
 */
export function ViewerView({
  luminaires,
  placements: _placements, // Used in Phase 4.3+
  viewerControls,
  floorPlanUpload,
  projectId,
  areaRevisionId,
  viewerBgTopColor = '#2a2a2a',
  viewerBgBottomColor = '#0a0a0a',
  markerMinScreenPx = 12,
  reverseZoomDirection = false,
  onAddPlacement: _onAddPlacement, // Used in Phase 4.4
  onRemovePlacement: _onRemovePlacement, // Used in Phase 4.4
}: ViewerViewProps) {
  const {
    placementMode,
    startPlacement,
    cancelPlacement,
    isPlacing,
  } = viewerControls

  const {
    selectedFile,
    existingUrn,
    triggerFileSelect,
    handleUploadComplete,
    handleTranslationComplete,
    handleUploadError,
  } = floorPlanUpload

  // Determine if we should show the viewer
  const showViewer = Boolean(selectedFile || existingUrn)

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* DWG Viewer area */}
        <div className="flex-1 flex flex-col">
          {showViewer && projectId && areaRevisionId ? (
            /* Forge Viewer - shows when file is selected or URN exists */
            <PlannerViewer
              file={selectedFile ?? undefined}
              urn={existingUrn ?? undefined}
              projectId={projectId}
              areaRevisionId={areaRevisionId}
              theme="dark"
              viewerBgTopColor={viewerBgTopColor}
              viewerBgBottomColor={viewerBgBottomColor}
              markerMinScreenPx={markerMinScreenPx}
              reverseZoomDirection={reverseZoomDirection}
              onUploadComplete={handleUploadComplete}
              onTranslationComplete={handleTranslationComplete}
              onError={handleUploadError}
              onReady={() => {
                console.log('[CaseStudy] Viewer ready')
              }}
              className="flex-1"
            />
          ) : (
            /* Empty state - no floor plan */
            <div className="flex-1 bg-[#1a1a2e] flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4 opacity-30">📐</div>
                <div className="text-lg text-white/50 mb-2">No Floor Plan</div>
                <div className="text-sm text-white/30 mb-6">
                  Upload an architectural DWG to get started
                </div>
                <Button
                  variant="secondary"
                  onClick={triggerFileSelect}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload DWG
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right panel - Products for placement */}
        <div className="w-56 border-l bg-background flex flex-col">
          <div className="p-3 border-b">
            <h3 className="text-sm font-medium">Products</h3>
            <p className="text-xs text-muted-foreground">
              {placementMode ? 'Click canvas to place' : 'Select product to place'}
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {luminaires.map((product) => {
                const isFullyPlaced = product.placed >= product.quantity
                const canPlace = product.placed < product.quantity
                const isCurrentlyPlacing = isPlacing(product.id)

                return (
                  <Card
                    key={product.id}
                    className={cn(
                      'transition-all',
                      canPlace && 'cursor-pointer hover:bg-muted/50',
                      isFullyPlaced && 'opacity-50',
                      isCurrentlyPlacing && 'ring-2 ring-primary bg-primary/5'
                    )}
                    onClick={() => {
                      if (isCurrentlyPlacing) {
                        // Click on highlighted product → deselect
                        cancelPlacement()
                      } else if (canPlace) {
                        // Click on different product → select it
                        startPlacement(product)
                      }
                    }}
                  >
                    <CardContent className="p-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'h-8 w-8 rounded flex items-center justify-center text-sm font-bold transition-colors',
                            isCurrentlyPlacing
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          {product.symbol}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {product.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {product.placed}/{product.quantity} placed
                            {isFullyPlaced && ' ✓'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {/* Add button */}
              <Button variant="outline" className="w-full h-12 flex-col gap-1">
                <Plus className="h-4 w-4" />
                <span className="text-xs">Add Product</span>
              </Button>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
