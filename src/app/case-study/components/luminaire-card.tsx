'use client'

import { Card, CardContent } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@fossapp/ui'
import { Package, Plus, Minus, CheckCircle2, Circle, Sparkles } from 'lucide-react'
import { cn } from '@fossapp/ui'
import type { LuminaireProduct } from '../types'

// Supabase storage URL for product-symbols bucket
const SYMBOLS_BUCKET_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-symbols`

interface LuminaireCardProps {
  product: LuminaireProduct
  onSymbolClick: () => void
  onTileClick: () => void
  onQuantityChange: (delta: number) => void
}

/**
 * Luminaire Card - Shows symbol, tile preview, and placement progress
 *
 * Design borrowed from planner's products-grid.tsx:
 * - Floating symbol badge (A1, B2) at top-left
 * - Placement status icon at top-right
 * - Color-coded borders based on placement status
 * - SVG symbol preview from storage
 */
export function LuminaireCard({
  product,
  onSymbolClick,
  onTileClick,
  onQuantityChange,
}: LuminaireCardProps) {
  const isFullyPlaced = product.placed >= product.quantity
  const isPartiallyPlaced = product.placed > 0 && product.placed < product.quantity
  const progress = product.quantity > 0 ? (product.placed / product.quantity) * 100 : 0

  // Construct symbol path: {foss_pid}/{foss_pid}-SYMBOL.svg
  const symbolSvgPath = product.hasSymbolDrawing
    ? `${product.code}/${product.code}-SYMBOL.svg`
    : null

  return (
    <Card
      className={cn(
        'w-40 shrink-0 relative transition-colors',
        isFullyPlaced
          ? 'bg-emerald-500/5 border-emerald-500/30'
          : isPartiallyPlaced
            ? 'bg-amber-500/5 border-amber-500/30'
            : 'hover:border-muted-foreground/50'
      )}
    >
      {/* Floating Symbol Badge - top left */}
      <Badge
        variant={product.symbol ? 'default' : 'outline'}
        className={cn(
          'absolute -top-2 -left-2 z-10 text-xs font-bold px-2 py-0.5',
          !product.symbol && 'bg-amber-500 text-white border-amber-500 hover:bg-amber-500'
        )}
      >
        {product.symbol || '?'}
      </Badge>

      {/* Placement Status Icon - top right */}
      <div className="absolute -top-2 -right-2 z-10">
        {isFullyPlaced ? (
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          </div>
        ) : isPartiallyPlaced ? (
          <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{product.placed}</span>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
            <Circle className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
      </div>

      <CardContent className="p-2 pt-3 space-y-1.5">
        {/* Symbol Drawing Preview */}
        <button
          type="button"
          onClick={onSymbolClick}
          className={cn(
            'w-full aspect-square rounded border flex items-center justify-center',
            'transition-colors hover:border-primary/50',
            symbolSvgPath
              ? 'border-border bg-zinc-800 hover:bg-zinc-700'
              : 'border-2 border-dashed border-muted-foreground/30 bg-muted/30 hover:bg-primary/5'
          )}
          title={symbolSvgPath ? 'View/edit symbol' : 'Generate symbol'}
        >
          {symbolSvgPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${SYMBOLS_BUCKET_URL}/${symbolSvgPath}`}
              alt={`Symbol for ${product.code}`}
              className="w-full h-full object-contain p-1"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Sparkles className="w-6 h-6" />
              <span className="text-[10px]">Generate Symbol</span>
            </div>
          )}
        </button>

        {/* Tile preview - twice the height of symbol when empty (aspect-[1/2] = width:height 1:2) */}
        <button
          type="button"
          onClick={onTileClick}
          className={cn(
            'w-full rounded flex items-center justify-center text-xs',
            product.hasTile ? 'h-10 border' : 'aspect-[3/4]',
            'transition-colors hover:border-primary/50',
            product.hasTile
              ? 'border-border bg-muted/50'
              : 'border-2 border-dashed border-muted-foreground/30 bg-muted/30 hover:bg-primary/5'
          )}
          title={product.hasTile ? 'View tile' : 'Create tile'}
        >
          {product.hasTile ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Package className="w-3.5 h-3.5" />
              <span className="text-[10px]">+{product.tileAccessoryCount} items</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[10px]">Generate Tile</span>
            </div>
          )}
        </button>

        {/* Product info */}
        <div className="space-y-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-xs font-medium truncate leading-tight cursor-default">{product.name}</div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>{product.name}</p>
            </TooltipContent>
          </Tooltip>
          <div className="text-[10px] text-muted-foreground font-mono truncate">{product.code}</div>
        </div>

        {/* Placement progress */}
        <div className="space-y-1">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all',
                isFullyPlaced
                  ? 'bg-emerald-500'
                  : isPartiallyPlaced
                    ? 'bg-amber-500'
                    : 'bg-primary'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className={cn(
              'text-[10px] font-medium',
              isFullyPlaced
                ? 'text-emerald-600'
                : isPartiallyPlaced
                  ? 'text-amber-600'
                  : 'text-muted-foreground'
            )}>
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
      </CardContent>
    </Card>
  )
}
