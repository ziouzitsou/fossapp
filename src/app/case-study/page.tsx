'use client'

import { useState } from 'react'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { CaseStudyToolbar } from './components'
import { ProductsView } from './components/products-view'
import { ViewerView } from './components/viewer-view'

// Mock data for Phase 1
const MOCK_AREAS = [
  { id: '1', name: 'Ground Floor' },
  { id: '2', name: 'First Floor' },
  { id: '3', name: 'Garden' },
]

export type ViewMode = 'products' | 'viewer'

export default function CaseStudyPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('products')
  const [selectedAreaId, setSelectedAreaId] = useState(MOCK_AREAS[0].id)

  return (
    <ProtectedPageLayout>
      <div className="flex h-full flex-col">
        {/* Toolbar - always visible */}
        <CaseStudyToolbar
          areas={MOCK_AREAS}
          selectedAreaId={selectedAreaId}
          onAreaChange={setSelectedAreaId}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Main content - switches based on view mode */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'products' ? (
            <ProductsView areaId={selectedAreaId} />
          ) : (
            <ViewerView areaId={selectedAreaId} />
          )}
        </div>
      </div>
    </ProtectedPageLayout>
  )
}
