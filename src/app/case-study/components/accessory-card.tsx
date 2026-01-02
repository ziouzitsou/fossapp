'use client'

import { Card, CardContent } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
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
 * Shows: Type icon, name, code, quantity controls, Add to Tile button.
 */
export function AccessoryCard({
  product,
  onAddToTile,
  onQuantityChange,
}: AccessoryCardProps) {
  const TypeIcon = getTypeIcon(product.type)

  return (
    <Card className="w-36 shrink-0">
      <CardContent className="p-2 space-y-2">
        {/* Product icon */}
        <div className="aspect-square rounded bg-muted flex items-center justify-center">
          <TypeIcon className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Product info */}
        <div className="space-y-0.5">
          <div className="text-xs font-medium truncate">{product.name}</div>
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
