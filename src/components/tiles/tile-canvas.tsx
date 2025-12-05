'use client'

import { Layers, Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useBucket } from '@/components/tiles/bucket-context'
import { CanvasDropZone } from './canvas-drop-zone'
import { DraggableProduct } from './draggable-product'
import { TileGroupCard } from './tile-group-card'
import { cn } from '@/lib/utils'

// Drop zone for creating new tiles
function NewTileDropZone() {
  const { isOver, setNodeRef } = useDroppable({
    id: 'canvas-drop-zone',
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 min-h-[120px] transition-colors',
        isOver
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-muted-foreground/30 text-muted-foreground'
      )}
    >
      <Plus className="h-8 w-8" />
      <span className="text-sm font-medium">Drop here to create new tile</span>
    </div>
  )
}

export function TileCanvas() {
  const { canvasItems, tileGroups, removeFromCanvas, clearAllTiles } = useBucket()
  const hasContent = canvasItems.length > 0 || tileGroups.length > 0
  const totalItems = canvasItems.length + tileGroups.length

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Tiles
            {totalItems > 0 && (
              <Badge variant="secondary" className="ml-1">
                {tileGroups.length}
              </Badge>
            )}
          </CardTitle>
          {hasContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllTiles}
              className="text-muted-foreground hover:text-destructive"
            >
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0">
        {hasContent ? (
          <div className="p-4 grid grid-cols-2 gap-4 auto-rows-max">
            {/* Standalone canvas items */}
            {canvasItems.map((item) => (
              <DraggableProduct
                key={item.product.product_id}
                item={item}
                isOver={false}
                onRemove={() => removeFromCanvas(item.product.product_id)}
              />
            ))}

            {/* Tile groups */}
            {tileGroups.map((group) => (
              <TileGroupCard
                key={group.id}
                group={group}
                isOver={false}
              />
            ))}

            {/* Drop zone for new tiles - always visible */}
            <NewTileDropZone />
          </div>
        ) : (
          <CanvasDropZone
            id="canvas-drop-zone"
            isOver={false}
            isEmpty={true}
          />
        )}
      </CardContent>
    </Card>
  )
}
