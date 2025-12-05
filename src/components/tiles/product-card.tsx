'use client'

import { BucketItem, getProductThumbnail } from '@/lib/tiles/types'
import { ProductImage } from './product-image'
import { cn } from '@/lib/utils'

interface ProductCardProps {
  item: BucketItem
  isDragging?: boolean
}

export function ProductCard({ item, isDragging }: ProductCardProps) {
  const imageUrl = getProductThumbnail(item.product)

  return (
    <div
      className={cn(
        'bg-card border rounded-lg p-3 w-[140px] shadow-lg',
        isDragging && 'rotate-3 scale-105'
      )}
    >
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
    </div>
  )
}
