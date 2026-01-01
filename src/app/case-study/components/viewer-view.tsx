'use client'

import { useState } from 'react'
import { Card, CardContent } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { ScrollArea } from '@fossapp/ui'
import {
  MousePointer,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize,
  Plus,
  MapPin,
} from 'lucide-react'
import { cn } from '@fossapp/ui'
import { StatusBar } from './status-bar'

// Mock luminaires for the right panel
const MOCK_VIEWER_PRODUCTS = [
  { id: '1', symbol: 'A1', name: 'BOXY XL', placed: 3, quantity: 5 },
  { id: '2', symbol: 'A2', name: 'BOXY S', placed: 0, quantity: 3 },
  { id: '3', symbol: 'A3', name: 'MINI GRID', placed: 8, quantity: 8 },
  { id: '4', symbol: 'B1', name: 'PENDANT L', placed: 1, quantity: 2 },
  { id: '5', symbol: 'N1', name: 'TRACK SPOT', placed: 2, quantity: 4 },
]

interface ViewerViewProps {
  areaId: string
}

export function ViewerView({ areaId }: ViewerViewProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [placingProduct, setPlacingProduct] = useState<string | null>(null)
  const [viewerTool, setViewerTool] = useState<'select' | 'pan'>('select')

  const handleViewerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    // Simulate CAD coordinates (scaled for demo)
    setMousePos({
      x: (e.clientX - rect.left) * 10,
      y: (rect.height - (e.clientY - rect.top)) * 10,
    })
  }

  const handlePlaceClick = (productId: string, symbol: string) => {
    setPlacingProduct(`Place ${symbol}`)
  }

  const handleCancelPlace = () => {
    setPlacingProduct(null)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* DWG Viewer area */}
        <div className="flex-1 flex flex-col">
          {/* Viewer canvas */}
          <div
            className="flex-1 bg-[#1a1a2e] relative cursor-crosshair"
            onMouseMove={handleViewerMouseMove}
          >
            {/* Placeholder content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white/30">
                <div className="text-6xl mb-4">📐</div>
                <div className="text-lg">DWG Viewer</div>
                <div className="text-sm">Upload a floor plan to get started</div>
              </div>
            </div>

            {/* Mock placed symbols */}
            <div className="absolute top-20 left-32 bg-primary/20 border border-primary rounded px-2 py-1 text-xs text-primary">
              A1
            </div>
            <div className="absolute top-40 left-64 bg-primary/20 border border-primary rounded px-2 py-1 text-xs text-primary">
              A1
            </div>
            <div className="absolute top-60 left-48 bg-primary/20 border border-primary rounded px-2 py-1 text-xs text-primary">
              B1
            </div>

            {/* Viewer toolbar */}
            <div className="absolute bottom-4 left-4 flex gap-1 bg-background/90 rounded-md p-1 shadow-lg">
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', viewerTool === 'select' && 'bg-muted')}
                onClick={() => setViewerTool('select')}
              >
                <MousePointer className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', viewerTool === 'pan' && 'bg-muted')}
                onClick={() => setViewerTool('pan')}
              >
                <Move className="h-4 w-4" />
              </Button>
              <div className="w-px bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right panel - Products for placement */}
        <div className="w-56 border-l bg-background flex flex-col">
          <div className="p-3 border-b">
            <h3 className="text-sm font-medium">Products</h3>
            <p className="text-xs text-muted-foreground">Click to place on viewer</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {MOCK_VIEWER_PRODUCTS.map((product) => {
                const isFullyPlaced = product.placed >= product.quantity
                const canPlace = product.placed < product.quantity

                return (
                  <Card
                    key={product.id}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isFullyPlaced && 'opacity-50',
                      placingProduct === `Place ${product.symbol}` && 'ring-2 ring-primary'
                    )}
                  >
                    <CardContent className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-sm font-bold">
                          {product.symbol}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {product.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {product.placed}/{product.quantity} placed
                          </div>
                        </div>
                        <Button
                          variant={canPlace ? 'default' : 'ghost'}
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={!canPlace}
                          onClick={() => handlePlaceClick(product.id, product.symbol)}
                        >
                          <MapPin className="h-3 w-3" />
                          Place
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {/* Add button */}
              <Button
                variant="outline"
                className="w-full h-12 flex-col gap-1"
              >
                <Plus className="h-4 w-4" />
                <span className="text-xs">Add Product</span>
              </Button>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar
        x={mousePos.x}
        y={mousePos.y}
        mode={placingProduct}
        onCancel={handleCancelPlace}
      />
    </div>
  )
}
