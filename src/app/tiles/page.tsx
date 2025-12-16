'use client'

import { Plus, Check } from 'lucide-react'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { DndProvider } from '@/components/tiles/dnd-provider'
import { ProductSearch } from '@/components/shared/product-search'
import { ProductBucket } from '@/components/tiles/product-bucket'
import { TileCanvas } from '@/components/tiles/tile-canvas'
import { useBucket } from '@/components/tiles/bucket-context'

function TilesContent() {
  const { addToBucket, isInBucket } = useBucket()

  return (
    <div className="flex flex-col h-full p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Tile Builder</h1>
        <p className="text-muted-foreground mt-2">Create DWG tile drawings from product images</p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <ProductSearch
          onProductAction={addToBucket}
          actionLabel="Add to Bucket"
          actionIcon={<Plus className="h-4 w-4 mr-1" />}
          isActionDisabled={(product) => isInBucket(product.product_id)}
          actionCompletedLabel="In Bucket"
          actionCompletedIcon={<Check className="h-4 w-4 mr-1" />}
          historyKey="tiles"
          placeholder="Search by foss_pid (e.g., MY8204045139)"
          clearOnAction
        />
      </div>

      {/* Main Content Area - Stacked layout for mobile */}
      <div className="flex flex-col flex-1 gap-4 overflow-hidden">
        {/* Top: Product Bucket (horizontal scroll) */}
        <div className="flex-shrink-0">
          <ProductBucket />
        </div>

        {/* Bottom: Tile Canvas */}
        <div className="flex-1 overflow-hidden min-h-0">
          <TileCanvas />
        </div>
      </div>
    </div>
  )
}

export default function TilesPage() {
  return (
    <ProtectedPageLayout>
      {/* BucketProvider now in global providers.tsx */}
      <DndProvider>
        <TilesContent />
      </DndProvider>
    </ProtectedPageLayout>
  )
}
