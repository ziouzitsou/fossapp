'use client'

import { useState, ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  closestCenter,
} from '@dnd-kit/core'
import { useBucket } from '@/components/tiles/bucket-context'
import { BucketItem } from '@/lib/tiles/types'
import { ProductCard } from './product-card'

interface DndProviderProps {
  children: ReactNode
}

export function DndProvider({ children }: DndProviderProps) {
  const {
    bucketItems,
    canvasItems,
    tileGroups,
    addToCanvas,
    createTileFromBucket,
    createTileGroupFromCanvas,
    addToTileGroup,
    addToTileGroupFromCanvas,
    reorderTileMembers,
    getBucketItem,
    getCanvasItem,
  } = useBucket()

  const [activeItem, setActiveItem] = useState<BucketItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const id = active.id as string

    // Check if it's a tile member (format: groupId:productId)
    if (id.includes(':')) {
      const [groupId, productId] = id.split(':')
      const group = tileGroups.find(g => g.id === groupId)
      const member = group?.members.find(m => m.product.product_id === productId)
      setActiveItem(member || null)
      return
    }

    const bucketItem = getBucketItem(id)
    const canvasItem = getCanvasItem(id)
    setActiveItem(bucketItem || canvasItem || null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveItem(null)

    if (!over) return

    const activeIdStr = active.id as string
    const overIdStr = over.id as string

    // Handle reordering within a tile group (both IDs have format groupId:productId)
    if (activeIdStr.includes(':') && overIdStr.includes(':')) {
      const [activeGroupId, activeProductId] = activeIdStr.split(':')
      const [overGroupId, overProductId] = overIdStr.split(':')

      // Only reorder if same group
      if (activeGroupId === overGroupId && activeProductId !== overProductId) {
        const group = tileGroups.find(g => g.id === activeGroupId)
        if (group) {
          const oldIndex = group.members.findIndex(m => m.product.product_id === activeProductId)
          const newIndex = group.members.findIndex(m => m.product.product_id === overProductId)
          if (oldIndex !== -1 && newIndex !== -1) {
            reorderTileMembers(activeGroupId, oldIndex, newIndex)
          }
        }
      }
      return
    }

    const isFromBucket = bucketItems.some(i => i.product.product_id === activeIdStr)
    const isFromCanvas = canvasItems.some(i => i.product.product_id === activeIdStr)

    // Dropping on canvas zone - create a single-member tile
    if (overIdStr === 'canvas-drop-zone') {
      if (isFromBucket) {
        createTileFromBucket(activeIdStr)
      }
      return
    }

    // Dropping on a tile group (by its droppable zone)
    if (overIdStr.startsWith('tile-group-')) {
      const groupId = overIdStr.replace('tile-group-', '')
      if (isFromBucket) {
        const item = getBucketItem(activeIdStr)
        if (item) addToTileGroup(groupId, item)
      } else if (isFromCanvas) {
        addToTileGroupFromCanvas(groupId, activeIdStr)
      }
      return
    }

    // Dropping on a tile member (format: groupId:productId) - add to that group
    if (overIdStr.includes(':') && !activeIdStr.includes(':')) {
      const [groupId] = overIdStr.split(':')
      if (isFromBucket) {
        const item = getBucketItem(activeIdStr)
        if (item) addToTileGroup(groupId, item)
      } else if (isFromCanvas) {
        addToTileGroupFromCanvas(groupId, activeIdStr)
      }
      return
    }

    // Dropping on another canvas item (create group)
    const targetCanvasItem = canvasItems.find(i => i.product.product_id === overIdStr)
    if (targetCanvasItem && isFromCanvas && activeIdStr !== overIdStr) {
      createTileGroupFromCanvas(activeIdStr, overIdStr)
      return
    }

    // Dropping bucket item on canvas item → add to canvas first, then group
    if (targetCanvasItem && isFromBucket) {
      addToCanvas(activeIdStr)
      setTimeout(() => {
        createTileGroupFromCanvas(activeIdStr, overIdStr)
      }, 0)
      return
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}

      <DragOverlay>
        {activeItem ? <ProductCard item={activeItem} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}
