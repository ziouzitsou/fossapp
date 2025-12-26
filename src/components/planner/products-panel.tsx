'use client'

/**
 * ProductsPanel - Sidebar showing project products for click-to-place
 *
 * Displays products from the active project that can be clicked
 * to enter placement mode, then click on floor plan to place.
 */

import { useMemo } from 'react'
import { Package, MousePointer2, ChevronDown, X } from 'lucide-react'
import { cn } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@fossapp/ui'
import type { AreaVersionProduct } from '@/lib/actions/project-areas'
import type { Placement, PlacementModeProduct } from './types'

interface ProductsPanelProps {
  /** Products from the selected area version */
  products: AreaVersionProduct[]
  /** Current placements (to show placed count) */
  placements: Placement[]
  /** Currently selected product for placement */
  placementMode: PlacementModeProduct | null
  /** Called when user clicks a product to enter placement mode */
  onEnterPlacementMode: (product: PlacementModeProduct) => void
  /** Called to exit placement mode */
  onExitPlacementMode: () => void
  /** Whether the panel is collapsed */
  isCollapsed?: boolean
  /** Toggle collapse callback */
  onToggleCollapse?: () => void
  /** Additional class name */
  className?: string
}

interface ProductCardProps {
  product: AreaVersionProduct
  placedCount: number
  isSelected: boolean
  onSelect: () => void
}

function ProductCard({ product, placedCount, isSelected, onSelect }: ProductCardProps) {
  const remaining = product.quantity - placedCount
  const isDisabled = remaining <= 0

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onSelect}
      disabled={isDisabled}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg border bg-card text-left transition-all',
        isSelected
          ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
          : 'hover:bg-accent hover:border-accent-foreground/20',
        isDisabled && 'opacity-50 cursor-not-allowed',
        !isDisabled && !isSelected && 'cursor-pointer'
      )}
    >
      {/* Selection indicator */}
      <div className={cn(
        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
        isSelected
          ? 'border-primary bg-primary'
          : 'border-muted-foreground/30'
      )}>
        {isSelected && <MousePointer2 className="h-3 w-3 text-primary-foreground" />}
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium truncate">
            {product.foss_pid}
          </span>
          {placedCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {placedCount}/{product.quantity}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate leading-relaxed">
          {product.description_short}
        </p>
      </div>

      {/* Quantity badge */}
      <Badge
        variant={remaining > 0 ? 'outline' : 'secondary'}
        className="flex-shrink-0 tabular-nums"
      >
        {remaining > 0 ? remaining : 0}
      </Badge>
    </button>
  )
}

export function ProductsPanel({
  products,
  placements,
  placementMode,
  onEnterPlacementMode,
  onExitPlacementMode,
  isCollapsed = false,
  onToggleCollapse,
  className,
}: ProductsPanelProps) {
  // Count placements per product
  const placementCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const placement of placements) {
      const current = counts.get(placement.projectProductId) || 0
      counts.set(placement.projectProductId, current + 1)
    }
    return counts
  }, [placements])

  // Group products by room_location (if available)
  const groupedProducts = useMemo(() => {
    const groups = new Map<string, AreaVersionProduct[]>()

    for (const product of products) {
      const location = product.room_location || 'Unassigned'
      const group = groups.get(location) || []
      group.push(product)
      groups.set(location, group)
    }

    return groups
  }, [products])

  // Handler for clicking a product
  const handleProductClick = (product: AreaVersionProduct) => {
    // If same product clicked, toggle off
    if (placementMode?.projectProductId === product.id) {
      onExitPlacementMode()
    } else {
      onEnterPlacementMode({
        projectProductId: product.id,
        productId: product.product_id,
        fossPid: product.foss_pid,
        description: product.description_short,
      })
    }
  }

  if (products.length === 0) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No products in area</p>
        <p className="text-xs mt-1">
          Add products to this area version to place them on the floor plan
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex-none px-4 py-4 border-b">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold">Product Groups</h3>
          <Badge variant="secondary" className="tabular-nums">{products.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Click to select, then click on floor plan
        </p>
      </div>

      {/* Product list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 space-y-3">
          {groupedProducts.size === 1 && groupedProducts.has('Unassigned') ? (
            // No grouping needed - flat list
            products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                placedCount={placementCounts.get(product.id) || 0}
                isSelected={placementMode?.projectProductId === product.id}
                onSelect={() => handleProductClick(product)}
              />
            ))
          ) : (
            // Grouped by room location
            Array.from(groupedProducts.entries()).map(([location, groupProducts]) => (
              <Collapsible key={location} defaultOpen className="space-y-2">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 h-9 px-2"
                  >
                    <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                    <span className="truncate font-medium">{location}</span>
                    <Badge variant="outline" className="ml-auto tabular-nums">
                      {groupProducts.length}
                    </Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 ml-2 pl-2 border-l border-border/50">
                  {groupProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      placedCount={placementCounts.get(product.id) || 0}
                      isSelected={placementMode?.projectProductId === product.id}
                      onSelect={() => handleProductClick(product)}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </div>

      {/* Placement mode indicator - above footer */}
      {placementMode && (
        <div className="flex-none mx-4 mb-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <MousePointer2 className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-medium text-primary truncate">
                {placementMode.fossPid}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-primary/20"
              onClick={onExitPlacementMode}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 ml-8">
            Click on floor plan to place
          </p>
        </div>
      )}

      {/* Footer with placement summary */}
      <div className="flex-none px-4 py-3 border-t bg-muted/30">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Placed</span>
          <span className="font-medium tabular-nums">{placements.length} markers</span>
        </div>
      </div>
    </div>
  )
}
