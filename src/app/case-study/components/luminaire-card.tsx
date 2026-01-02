'use client'

import { Card, CardContent } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Palette, Package, Plus, Minus } from 'lucide-react'
import { cn } from '@fossapp/ui'
import type { LuminaireProduct } from '../types'

interface LuminaireCardProps {
  product: LuminaireProduct
  onSymbolClick: () => void
  onTileClick: () => void
  onQuantityChange: (delta: number) => void
}

/**
 * Luminaire Card - Shows symbol, tile preview, and placement progress
 *
 * Displays:
 * - Symbol drawing (or letter badge fallback)
 * - Tile preview (if tile exists)
 * - Placement progress bar (3/5 placed)
 * - Quick actions: Symbol modal, Tile modal
 */
export function LuminaireCard({
  product,
  onSymbolClick,
  onTileClick,
  onQuantityChange,
}: LuminaireCardProps) {
  const isFullyPlaced = product.placed >= product.quantity
  const progress = product.quantity > 0 ? (product.placed / product.quantity) * 100 : 0

  return (
    <Card className={cn('w-44 shrink-0', isFullyPlaced && 'ring-2 ring-green-500/50')}>
      <CardContent className="p-2 space-y-2">
        {/* Symbol preview */}
        <div className="aspect-square rounded bg-muted flex items-center justify-center">
          {product.hasSymbolDrawing ? (
            <div className="text-center">
              <div className="text-2xl font-bold">{product.symbol}</div>
              <div className="text-[10px] text-muted-foreground">SVG</div>
            </div>
          ) : (
            <div className="text-3xl font-bold text-muted-foreground">
              {product.symbol}
            </div>
          )}
        </div>

        {/* Tile preview */}
        <div className="h-12 rounded bg-muted/50 flex items-center justify-center text-xs text-muted-foreground">
          {product.hasTile ? (
            <div className="text-center">
              <div className="text-[10px]">Tile</div>
              <div className="text-[9px]">+{product.tileAccessoryCount} items</div>
            </div>
          ) : (
            <span className="text-[10px]">No tile</span>
          )}
        </div>

        {/* Product info */}
        <div className="space-y-0.5">
          <div className="text-xs font-medium truncate">{product.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{product.code}</div>
        </div>

        {/* Placement progress */}
        <div className="space-y-1">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all',
                isFullyPlaced ? 'bg-green-500' : 'bg-primary'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {product.placed}/{product.quantity}
            </span>
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => onQuantityChange(-1)}
                disabled={product.quantity <= product.placed}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => onQuantityChange(1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs gap-1"
            onClick={onSymbolClick}
          >
            <Palette className="h-3 w-3" />
            Symbol
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs gap-1"
            onClick={onTileClick}
          >
            <Package className="h-3 w-3" />
            Tile
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
