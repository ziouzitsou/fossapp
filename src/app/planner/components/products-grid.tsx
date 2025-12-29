'use client'

/**
 * Products Grid Component
 * Displays products in a grid layout for the planner overview mode
 * Shows symbol badges, product info, quantity, and placement status
 */

import { Badge } from '@fossapp/ui'
import { cn } from '@fossapp/ui'
import { CheckCircle2, Circle } from 'lucide-react'
import type { AreaRevisionProduct } from '@/lib/actions/areas/revision-products-actions'
import type { Placement } from '@/components/planner'

interface ProductsGridProps {
  products: AreaRevisionProduct[]
  placements: Placement[]
  className?: string
}

export function ProductsGrid({ products, placements, className }: ProductsGridProps) {
  // Calculate placement counts per product
  const placementCounts = products.reduce((acc, product) => {
    acc[product.id] = placements.filter(p => p.projectProductId === product.id).length
    return acc
  }, {} as Record<string, number>)

  // Calculate symbol summary (including unclassified as '?')
  const symbolSummary = products.reduce((acc, product) => {
    const code = product.symbol_code || '?'
    acc[code] = (acc[code] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Calculate total placed vs total quantity
  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0)
  const totalPlaced = Object.values(placementCounts).reduce((sum, count) => sum + count, 0)

  if (products.length === 0) {
    return (
      <div className={cn('rounded-lg border-2 border-dashed border-muted-foreground/20 p-8 text-center', className)}>
        <p className="text-muted-foreground">No products assigned to this area yet.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Add products from the Project page.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Products Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {products.map((product) => {
          const placedCount = placementCounts[product.id] || 0
          const isFullyPlaced = placedCount >= product.quantity
          const isPartiallyPlaced = placedCount > 0 && placedCount < product.quantity

          return (
            <div
              key={product.id}
              className={cn(
                'relative p-3 rounded-lg border transition-colors',
                isFullyPlaced
                  ? 'bg-emerald-500/5 border-emerald-500/30'
                  : isPartiallyPlaced
                    ? 'bg-amber-500/5 border-amber-500/30'
                    : 'bg-card border-border hover:border-muted-foreground/50'
              )}
            >
              {/* Symbol Badge */}
              <Badge
                variant={product.symbol ? 'default' : 'outline'}
                className={cn(
                  'absolute -top-2 -left-2 text-xs font-bold px-2 py-0.5',
                  !product.symbol && 'bg-amber-500 text-white border-amber-500 hover:bg-amber-500'
                )}
              >
                {product.symbol || '?'}
              </Badge>

              {/* Placement Status Icon */}
              <div className="absolute -top-2 -right-2">
                {isFullyPlaced ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  </div>
                ) : isPartiallyPlaced ? (
                  <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{placedCount}</span>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                    <Circle className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="mt-2 space-y-1">
                <p className="text-xs font-mono text-muted-foreground truncate">
                  {product.foss_pid}
                </p>
                <p className="text-sm font-medium leading-tight line-clamp-2 min-h-[2.5rem]">
                  {product.description_short}
                </p>
              </div>

              {/* Quantity & Placement Status */}
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Qty: {product.quantity}
                </span>
                <span className={cn(
                  'font-medium',
                  isFullyPlaced
                    ? 'text-emerald-600'
                    : isPartiallyPlaced
                      ? 'text-amber-600'
                      : 'text-muted-foreground'
                )}>
                  {placedCount}/{product.quantity}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between px-1 pt-2 border-t">
        {/* Symbol Summary */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Symbols:</span>
          <div className="flex items-center gap-1.5">
            {Object.entries(symbolSummary)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([code, count]) => (
                <Badge
                  key={code}
                  variant="secondary"
                  className={cn(
                    'text-xs px-1.5 py-0',
                    code === '?' && 'bg-amber-500 text-white hover:bg-amber-500'
                  )}
                >
                  [{code}] ×{count}
                </Badge>
              ))}
          </div>
        </div>

        {/* Placement Summary */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Placed:</span>
          <span className={cn(
            'text-sm font-medium',
            totalPlaced === totalQuantity
              ? 'text-emerald-600'
              : totalPlaced > 0
                ? 'text-amber-600'
                : 'text-muted-foreground'
          )}>
            {totalPlaced} / {totalQuantity}
          </span>
        </div>
      </div>
    </div>
  )
}
