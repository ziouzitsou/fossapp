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
        <div className="flex flex-col h-full">
          {/* Search Bar at Top */}
          <div className="p-4 border-b bg-background">
            <ProductSearch />
          </div>

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden">
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
