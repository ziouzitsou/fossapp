'use client'

import { Card, CardContent } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { ScrollArea } from '@fossapp/ui'
import {
  MousePointer,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize,
  Plus,
} from 'lucide-react'
import { cn } from '@fossapp/ui'
import { StatusBar } from './status-bar'
import type { LuminaireProduct, Placement, ViewerCoordinates } from '../types'
import type { ViewerControlsValue } from '../hooks'

interface ViewerViewProps {
  luminaires: LuminaireProduct[]
  placements: Placement[]
  viewerControls: ViewerControlsValue
  onAddPlacement: (
    projectProductId: string,
    symbol: string,
    coords: ViewerCoordinates,
    rotation?: number
  ) => Placement
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
  placements,
  viewerControls,
  onAddPlacement,
  onRemovePlacement,
}: ViewerViewProps) {
  const {
    viewerRef,
    viewerTool,
    setViewerTool,
    placementMode,
    startPlacement,
    cancelPlacement,
    isPlacing,
    mousePosition,
    handleViewerMouseMove,
    zoomIn,
    zoomOut,
    zoomFit,
  } = viewerControls

  /** Handle click on viewer canvas */
  const handleViewerClick = () => {
    if (placementMode) {
      // Place the product at current mouse position
      onAddPlacement(
        placementMode.productId,
        placementMode.symbol,
        mousePosition,
        0 // Default rotation
      )
      // Don't cancel - allow placing multiple of the same product
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* DWG Viewer area */}
        <div className="flex-1 flex flex-col">
          {/* Viewer canvas */}
          <div
            ref={viewerRef}
            className={cn(
              'flex-1 bg-[#1a1a2e] relative',
              placementMode ? 'cursor-crosshair' : viewerTool === 'pan' ? 'cursor-grab' : 'cursor-default'
            )}
            onMouseMove={handleViewerMouseMove}
            onClick={handleViewerClick}
          >
            {/* Placeholder content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white/30">
                <div className="text-6xl mb-4">📐</div>
                <div className="text-lg">DWG Viewer</div>
                <div className="text-sm">Upload a floor plan to get started</div>
              </div>
            </div>

            {/* Render placed symbols */}
            {placements.map((placement) => (
              <div
                key={placement.id}
                className="absolute bg-primary/20 border border-primary rounded px-2 py-1 text-xs text-primary cursor-pointer hover:bg-primary/30 transition-colors"
                style={{
                  // Mock positioning - in Phase 4 this will use real coordinate transformation
                  left: `${(placement.worldX / 100) % 80 + 10}%`,
                  top: `${(placement.worldY / 100) % 80 + 10}%`,
                  transform: `rotate(${placement.rotation}deg)`,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  // TODO: Select placement for editing
                  console.log('Selected placement:', placement.id)
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  onRemovePlacement(placement.id)
                }}
                title="Double-click to remove"
              >
                {placement.symbol}
              </div>
            ))}

            {/* Placement preview (ghost) */}
            {placementMode && (
              <div
                className="absolute bg-primary/40 border-2 border-dashed border-primary rounded px-2 py-1 text-xs text-primary pointer-events-none"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {placementMode.symbol}
              </div>
            )}

            {/* Viewer toolbar */}
            <div className="absolute bottom-4 left-4 flex gap-1 bg-background/90 rounded-md p-1 shadow-lg">
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', viewerTool === 'select' && 'bg-muted')}
                onClick={() => setViewerTool('select')}
                title="Select (V)"
              >
                <MousePointer className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', viewerTool === 'pan' && 'bg-muted')}
                onClick={() => setViewerTool('pan')}
                title="Pan (hold Space)"
              >
                <Move className="h-4 w-4" />
              </Button>
              <div className="w-px bg-border mx-1" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={zoomIn}
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={zoomOut}
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={zoomFit}
                title="Fit to View"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
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

      {/* Status bar */}
      <StatusBar
        x={mousePosition.x}
        y={mousePosition.y}
        mode={placementMode ? `Place ${placementMode.symbol}` : null}
        onCancel={cancelPlacement}
      />
    </div>
  )
}
