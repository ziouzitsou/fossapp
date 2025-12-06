'use client'

import { useDraggable } from '@dnd-kit/core'
import { X, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useBucket } from '@/components/tiles/bucket-context'
import { BucketItem, getProductThumbnail } from '@/lib/tiles/types'
import { ProductImage } from './product-image'
import { cn } from '@/lib/utils'

function DraggableBucketItem({ item, onRemove }: { item: BucketItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.product.product_id,
  })

  const imageUrl = getProductThumbnail(item.product)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'group relative p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-muted-foreground/80 text-background opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <X className="h-2.5 w-2.5" />
      </Button>

      {/* Thumbnail */}
      <div className="flex justify-center mb-2">
        <ProductImage
          src={imageUrl}
          alt={item.product.description_short}
          size="md"
        />
      </div>

      {/* Product Info */}
      <p className="text-xs font-medium truncate text-center" title={item.product.description_short}>
        {item.product.description_short}
      </p>
      <p className="text-[10px] text-muted-foreground font-mono truncate text-center">
        {item.product.foss_pid}
      </p>
    </div>
  )
}

export function ProductBucket() {
  const { bucketItems, removeFromBucket, clearBucket } = useBucket()

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-shrink-0 py-2 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Bucket
            {bucketItems.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {bucketItems.length}
              </Badge>
            )}
          </CardTitle>
          {bucketItems.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearBucket}
              className="text-muted-foreground hover:text-destructive h-7 text-xs"
            >
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-2 pt-0">
        {bucketItems.length === 0 ? (
          <div className="flex items-center justify-center text-muted-foreground px-4 py-4">
            <Package className="h-8 w-8 mr-3 opacity-50" />
            <p className="text-sm">
              Search and add products to your bucket
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex gap-2 pb-2">
              {bucketItems.map((item) => (
                <div key={item.product.product_id} className="flex-shrink-0 w-28">
                  <DraggableBucketItem
                    item={item}
                    onRemove={() => removeFromBucket(item.product.product_id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
