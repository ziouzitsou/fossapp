'use client'

/**
 * Area Overview Component
 * Shows floor plan card and products grid in overview mode
 */

import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button, Badge } from '@fossapp/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@fossapp/ui'
import { FloorPlanCard, ProductsGrid, SymbolModal } from './index'
import type { AreaRevisionProduct } from '@/lib/actions/areas/revision-products-actions'
import type { PlannerState } from '../types'

interface AreaOverviewProps {
  state: PlannerState
}

export function AreaOverview({ state }: AreaOverviewProps) {
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
        onSymbolGenerated={refreshProducts}
      />
    </div>
  )
}
