'use client'

import { useMemo, useCallback } from 'react'
import { Card, CardContent } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { ScrollArea } from '@fossapp/ui'
import { RefreshCw, Upload, Eye, EyeOff } from 'lucide-react'
import { cn } from '@fossapp/ui'
import { CaseStudyViewer } from '@/components/case-study-viewer'
import type { PlacementModeProduct, Placement as PlannerPlacement } from '@/components/case-study-viewer/types'
import type { LuminaireProduct, Placement, ViewerCoordinates } from '../types'
import type { ViewerControlsValue, FloorPlanUploadValue } from '../hooks'

// ============================================================================
// TYPE CONVERSIONS - Case Study ↔ CaseStudyViewer
// ============================================================================

/**
 * Convert case-study PlacementMode to viewer's PlacementModeProduct
 */
function toPlacementModeProduct(
  mode: { productId: string; symbol: string; productName: string } | null,
  luminaires: LuminaireProduct[]
): PlacementModeProduct | null {
  if (!mode) return null

  const luminaire = luminaires.find(l => l.id === mode.productId)
  if (!luminaire) return null

  return {
    projectProductId: mode.productId,  // case-study uses productId for project_products.id
    productId: luminaire.productId,    // items.product.id
    fossPid: luminaire.code,
    description: luminaire.name,
    symbol: mode.symbol,
  }
}

/**
 * Convert case-study Placements to viewer Placements format
 * (adds productName, fossPid, dbId placeholder)
 */
function toViewerPlacements(
  placements: Placement[],
  luminaires: LuminaireProduct[]
): PlannerPlacement[] {
  return placements.map((p, index) => {
    const luminaire = luminaires.find(l => l.id === p.projectProductId)
    return {
      id: p.id,
      productId: p.productId,
      projectProductId: p.projectProductId,
      productName: luminaire?.name || p.symbol,
      fossPid: luminaire?.code,  // FOSS product ID for SVG symbol lookup
      worldX: p.worldX,
      worldY: p.worldY,
      dbId: index + 1,  // Placeholder - viewer regenerates on render
      rotation: p.rotation,
      symbol: p.symbol,
    }
  })
}

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
  /** Add a placement - id is provided by PlannerViewer to prevent duplicates */
  onAddPlacement: (
    id: string,
    projectProductId: string,
    symbol: string,
    coords: ViewerCoordinates,
    rotation?: number
  ) => Placement | null
  onRemovePlacement: (placementId: string) => void
  /** Rotate a placement (R key shortcut) */
  onRotatePlacement?: (placementId: string, rotation: number) => void
  /** Move a placement (M key + click) */
  onMovePlacement?: (placementId: string, worldX: number, worldY: number) => void
  /** Refresh products after adding via search */
  onRefresh?: () => void
  /** Whether refresh is in progress */
  isRefreshing?: boolean
  /** Set of hidden symbol group letters (e.g., "A", "B") */
  hiddenSymbolGroups?: Set<string>
  /** Toggle visibility of a symbol group */
  toggleSymbolGroupVisibility?: (symbolLetter: string) => void
}

/**
 * Viewer View - DWG canvas with pick-and-place functionality
 *
 * Left side: DWG viewer canvas with APS Viewer
 * Right side: Products panel for placement selection
 */
export function ViewerView({
  luminaires,
  placements,
  viewerControls,
  floorPlanUpload,
  projectId,
  areaRevisionId,
  viewerBgTopColor = '#2a2a2a',
  viewerBgBottomColor = '#0a0a0a',
  markerMinScreenPx = 12,
  reverseZoomDirection = false,
  onAddPlacement,
  onRemovePlacement,
  onRotatePlacement,
  onMovePlacement,
  onRefresh,
  isRefreshing = false,
  hiddenSymbolGroups,
  toggleSymbolGroupVisibility,
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

  // ============================================================================
  // MEMOIZED CONVERSIONS - Case Study → Viewer format
  // ============================================================================

  /** Convert case-study placementMode to viewer format */
  const viewerPlacementMode = useMemo(
    () => toPlacementModeProduct(placementMode, luminaires),
    [placementMode, luminaires]
  )

  /** Convert case-study placements to viewer format */
  const viewerPlacements = useMemo(
    () => toViewerPlacements(placements, luminaires),
    [placements, luminaires]
  )

  // ============================================================================
  // CALLBACKS - Handle placement events from CaseStudyViewer
  // ============================================================================

  /** Handle new placement from viewer click */
  const handlePlacementAdd = useCallback(
    (placement: Omit<PlannerPlacement, 'dbId'>) => {
      // Pass the ID from CaseStudyViewer to prevent duplicate markers
      // (CaseStudyViewer already registered this ID in renderedPlacementIdsRef)
      onAddPlacement(
        placement.id,
        placement.projectProductId,
        placement.symbol || '',
        { x: placement.worldX, y: placement.worldY },
        placement.rotation
      )
    },
    [onAddPlacement]
  )

  /** Handle placement deletion */
  const handlePlacementDelete = useCallback(
    (id: string) => {
      onRemovePlacement(id)
    },
    [onRemovePlacement]
  )

  /** Handle placement rotation (R key shortcut) */
  const handlePlacementRotate = useCallback(
    (id: string, rotation: number) => {
      onRotatePlacement?.(id, rotation)
    },
    [onRotatePlacement]
  )

  /** Handle placement move (M key + click) */
  const handlePlacementMove = useCallback(
    (id: string, worldX: number, worldY: number) => {
      onMovePlacement?.(id, worldX, worldY)
    },
    [onMovePlacement]
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* DWG Viewer area */}
        <div className="flex-1 flex flex-col">
          {showViewer && projectId && areaRevisionId ? (
            /* APS Viewer - shows when file is selected or URN exists */
            <CaseStudyViewer
              file={selectedFile ?? undefined}
              urn={existingUrn ?? undefined}
              projectId={projectId}
              areaRevisionId={areaRevisionId}
              theme="dark"
              viewerBgTopColor={viewerBgTopColor}
              viewerBgBottomColor={viewerBgBottomColor}
              markerMinScreenPx={markerMinScreenPx}
              reverseZoomDirection={reverseZoomDirection}
              hiddenSymbolGroups={hiddenSymbolGroups}
              // Placement props
              placementMode={viewerPlacementMode}
              initialPlacements={viewerPlacements}
              onPlacementAdd={handlePlacementAdd}
              onPlacementDelete={handlePlacementDelete}
              onPlacementRotate={handlePlacementRotate}
              onPlacementMove={handlePlacementMove}
              onExitPlacementMode={cancelPlacement}
              // Upload callbacks
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
        <div className="w-52 border-l bg-background flex flex-col">
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
                const isHidden = hiddenSymbolGroups?.has(product.symbol) ?? false

                return (
                  <Card
                    key={product.id}
                    className={cn(
                      'transition-all overflow-hidden',
                      canPlace && !isHidden && 'cursor-pointer hover:bg-muted/50',
                      isFullyPlaced && 'opacity-50',
                      isCurrentlyPlacing && 'ring-2 ring-primary bg-primary/5',
                      isHidden && 'opacity-50'
                    )}
                    onClick={() => {
                      if (isCurrentlyPlacing) {
                        cancelPlacement()
                      } else if (canPlace) {
                        startPlacement(product)
                      }
                    }}
                  >
                    <CardContent className="p-1.5">
                      <div className="flex items-center gap-1.5">
                        {/* Eye toggle - left of symbol */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSymbolGroupVisibility?.(product.symbol)
                          }}
                          className={cn(
                            'p-0.5 rounded hover:bg-muted transition-colors flex-shrink-0',
                            isHidden && 'text-muted-foreground'
                          )}
                          title={isHidden ? `Show ${product.symbol}` : `Hide ${product.symbol}`}
                        >
                          {isHidden ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </button>
                        {/* Symbol badge */}
                        <div
                          className={cn(
                            'h-6 w-6 rounded flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0',
                            isCurrentlyPlacing
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          {product.symbol}
                        </div>
                        {/* Product info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium leading-tight">
                            {product.name}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            {product.placed}/{product.quantity}
                            {isFullyPlaced && ' ✓'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {/* Refresh button */}
              <Button
                variant="outline"
                className="w-full h-10 gap-2"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                <span className="text-xs">{isRefreshing ? 'Refreshing...' : 'Refresh Products'}</span>
              </Button>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
