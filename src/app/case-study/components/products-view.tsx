'use client'

import { Button } from '@fossapp/ui'
import { ScrollArea, ScrollBar } from '@fossapp/ui'
import { TooltipProvider } from '@fossapp/ui'
import { cn } from '@fossapp/ui'
import { RefreshCw } from 'lucide-react'
import { LuminaireCard } from './luminaire-card'
import { AccessoryCard } from './accessory-card'
import type { LuminaireProduct, AccessoryProduct } from '../types'

interface ProductsViewProps {
  luminaires: LuminaireProduct[]
  accessories: AccessoryProduct[]
  onLuminaireQuantityChange: (id: string, delta: number) => void
  onAccessoryQuantityChange: (id: string, delta: number) => void
  onSymbolClick: (id: string) => void
  onTileClick: (id: string) => void
  onAddToTile: (id: string) => void
  /** Refresh products after adding via search */
  onRefresh?: () => void
  /** Whether refresh is in progress */
  isRefreshing?: boolean
}

/**
 * Products View - Horizontal scrolling product cards
 *
 * Shows luminaires (with symbols/tiles) and accessories (drivers/optics).
 * Each section scrolls horizontally to accommodate many products.
 */
export function ProductsView({
  luminaires,
  accessories,
  onLuminaireQuantityChange,
  onAccessoryQuantityChange,
  onSymbolClick,
  onTileClick,
  onAddToTile,
  onRefresh,
  isRefreshing = false,
}: ProductsViewProps) {
  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex flex-col gap-4 p-4">
      {/* Luminaires section */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          Luminaires ({luminaires.length})
        </h2>
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          {/* Extra padding for floating badges: pt-3 for top badge, pl-3 for left badge */}
          <div className="flex gap-3 pt-3 pb-1 px-3">
            {luminaires.map((product) => (
              <LuminaireCard
                key={product.id}
                product={product}
                onSymbolClick={() => onSymbolClick(product.id)}
                onTileClick={() => onTileClick(product.id)}
                onQuantityChange={(delta) => onLuminaireQuantityChange(product.id, delta)}
              />
            ))}
            {/* Refresh button - use after adding products via / search */}
            <Button
              variant="outline"
              className="w-40 h-auto shrink-0 flex-col gap-2 py-6"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-5 w-5', isRefreshing && 'animate-spin')} />
              <span className="text-xs">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              <span className="text-[10px] text-muted-foreground">Press / to add</span>
            </Button>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>

      {/* Accessories section */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          Accessories & Drivers ({accessories.length})
        </h2>
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <div className="flex gap-3 py-1 px-1">
            {accessories.map((product) => (
              <AccessoryCard
                key={product.id}
                product={product}
                onAddToTile={() => onAddToTile(product.id)}
                onQuantityChange={(delta) => onAccessoryQuantityChange(product.id, delta)}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>
    </div>
    </TooltipProvider>
  )
}
