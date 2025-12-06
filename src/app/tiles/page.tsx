'use client'

import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { DndProvider } from '@/components/tiles/dnd-provider'
import { ProductSearch } from '@/components/tiles/product-search'
import { ProductBucket } from '@/components/tiles/product-bucket'
import { TileCanvas } from '@/components/tiles/tile-canvas'

export default function TilesPage() {
  return (
    <ProtectedPageLayout>
      {/* BucketProvider now in global providers.tsx */}
      <DndProvider>
        <div className="flex flex-col h-full p-6">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Tile Builder</h1>
            <p className="text-muted-foreground mt-2">Create DWG tile drawings from product images</p>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <ProductSearch />
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
      </DndProvider>
    </ProtectedPageLayout>
  )
}
