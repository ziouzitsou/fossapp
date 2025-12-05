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

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden rounded-lg border bg-background">
            {/* Left: Product Bucket */}
            <div className="w-80 border-r overflow-hidden">
              <ProductBucket />
            </div>

            {/* Right: Tile Canvas */}
            <div className="flex-1 overflow-hidden">
              <TileCanvas />
            </div>
          </div>
        </div>
      </DndProvider>
    </ProtectedPageLayout>
  )
}
