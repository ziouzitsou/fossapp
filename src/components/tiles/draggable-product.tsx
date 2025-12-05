'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BucketItem, getProductThumbnail } from '@/lib/tiles/types'
import { ProductImage } from './product-image'
import { cn } from '@/lib/utils'

interface DraggableProductProps {
  item: BucketItem
  isOver: boolean
  onRemove: () => void
}

export function DraggableProduct({ item, isOver, onRemove }: DraggableProductProps) {
  const productId = item.product.product_id

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: productId,
  })

  const { setNodeRef: setDropRef } = useDroppable({
    id: productId,
  })

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }

  const imageUrl = getProductThumbnail(item.product)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'group relative bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all',
        isDragging && 'opacity-50 scale-95',
        isOver && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
      )}
    >
      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <X className="h-3 w-3" />
      </Button>

      {/* Product Image */}
      <div className="flex justify-center mb-2">
        <ProductImage
          src={imageUrl}
          alt={item.product.description_short}
          size="lg"
        />
      </div>

      {/* Product Info */}
      <p className="text-xs font-medium truncate" title={item.product.description_short}>
        {item.product.description_short}
      </p>
      <p className="text-[10px] text-muted-foreground font-mono truncate">
        {item.product.foss_pid}
      </p>

      {/* Drop indicator */}
      {isOver && (
        <div className="absolute inset-0 bg-primary/10 rounded-lg flex items-center justify-center">
          <span className="text-xs font-medium text-primary">Drop to group</span>
        </div>
      )}
    </div>
  )
}
