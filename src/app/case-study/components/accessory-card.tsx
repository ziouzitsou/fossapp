'use client'

import { useState } from 'react'
import { Card, CardContent } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@fossapp/ui'
import { Package, Plus, Minus, Zap, CircleDot, Wrench } from 'lucide-react'
import type { AccessoryProduct } from '../types'

interface AccessoryCardProps {
  product: AccessoryProduct
  onAddToTile: () => void
  onQuantityChange: (delta: number) => void
}

/** Get icon based on accessory type */
function getTypeIcon(type: AccessoryProduct['type']) {
  switch (type) {
    case 'driver':
      return Zap
    case 'optic':
      return CircleDot
    case 'mount':
      return Wrench
    default:
      return Package
  }
}

/**
 * Accessory Card - Simple card for drivers, optics, mounts
 *
 * Simpler than LuminaireCard - no symbols or placements.
 * Shows: Product image (MD02→MD01 or MD64→MD12), name, code, quantity, Add to Tile.
 */
export function AccessoryCard({
  product,
  onAddToTile,
  onQuantityChange,
}: AccessoryCardProps) {
  const TypeIcon = getTypeIcon(product.type)
  // Track image load failures for fallback chain: imageUrl → drawingUrl → icon
  const [imgError, setImgError] = useState(false)

  // Use imageUrl first, then drawingUrl as fallback
  const displayUrl = !imgError ? (product.imageUrl || product.drawingUrl) : product.drawingUrl
  const showImage = displayUrl && !(imgError && !product.drawingUrl)

  return (
    <Card className="w-36 shrink-0">
      <CardContent className="p-2 space-y-2">
        {/* Product image or icon fallback */}
        <div className="aspect-square rounded bg-muted flex items-center justify-center overflow-hidden">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt={product.name}
              className="w-full h-full object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <TypeIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        {/* Product info */}
        <div className="space-y-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-xs font-medium truncate cursor-default">{product.name}</div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>{product.name}</p>
            </TooltipContent>
          </Tooltip>
          <div className="text-[10px] text-muted-foreground truncate">{product.code}</div>
        </div>

        {/* Quantity controls */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Qty: {product.quantity}
          </span>
          <div className="flex gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => onQuantityChange(-1)}
              disabled={product.quantity <= 0}
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

        {/* Add to tile button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs gap-1"
          onClick={onAddToTile}
        >
          <Package className="h-3 w-3" />
          Add to Tile
        </Button>
      </CardContent>
    </Card>
  )
}
