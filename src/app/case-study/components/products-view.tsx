'use client'

import { useState } from 'react'
import { Button } from '@fossapp/ui'
import { ScrollArea, ScrollBar } from '@fossapp/ui'
import { Plus } from 'lucide-react'
import { LuminaireCard, type LuminaireProduct } from './luminaire-card'
import { AccessoryCard, type AccessoryProduct } from './accessory-card'

// Mock data for Phase 1
const MOCK_LUMINAIRES: LuminaireProduct[] = [
  { id: '1', name: 'BOXY XL', code: 'MY8204045139', symbol: 'A1', hasSymbolDrawing: true, hasTile: true, tileAccessories: ['Driver', 'Optic'], quantity: 5, placed: 3 },
  { id: '2', name: 'BOXY S', code: 'MY8204045140', symbol: 'A2', hasSymbolDrawing: true, hasTile: false, tileAccessories: [], quantity: 3, placed: 0 },
  { id: '3', name: 'MINI GRID', code: 'MY8204045141', symbol: 'A3', hasSymbolDrawing: false, hasTile: true, tileAccessories: ['Driver'], quantity: 8, placed: 8 },
  { id: '4', name: 'PENDANT L', code: 'MY8204045142', symbol: 'B1', hasSymbolDrawing: true, hasTile: false, tileAccessories: [], quantity: 2, placed: 1 },
  { id: '5', name: 'TRACK SPOT', code: 'MY8204045143', symbol: 'N1', hasSymbolDrawing: false, hasTile: false, tileAccessories: [], quantity: 4, placed: 2 },
  { id: '6', name: 'OUTDOOR IP65', code: 'MY8204045144', symbol: 'C1', hasSymbolDrawing: true, hasTile: true, tileAccessories: ['Mount'], quantity: 6, placed: 4 },
  { id: '7', name: 'LINEAR 120', code: 'MY8204045145', symbol: 'D1', hasSymbolDrawing: false, hasTile: false, tileAccessories: [], quantity: 10, placed: 5 },
  { id: '8', name: 'DOWNLIGHT PRO', code: 'MY8204045146', symbol: 'A4', hasSymbolDrawing: true, hasTile: true, tileAccessories: ['Driver', 'Optic', 'Frame'], quantity: 12, placed: 12 },
]

const MOCK_ACCESSORIES: AccessoryProduct[] = [
  { id: '101', name: 'Driver 350mA DALI', code: 'DRV350MA-DALI', type: 'driver', quantity: 5 },
  { id: '102', name: 'Optic 24° Narrow', code: 'OPT-24-BOXY', type: 'optic', quantity: 5 },
  { id: '103', name: 'Optic 36° Medium', code: 'OPT-36-BOXY', type: 'optic', quantity: 3 },
  { id: '104', name: 'Mount Bracket', code: 'MNT-BRK-01', type: 'mount', quantity: 2 },
  { id: '105', name: 'Emergency Kit', code: 'EMG-KIT-01', type: 'accessory', quantity: 4 },
]

interface ProductsViewProps {
  areaId: string
}

export function ProductsView({ areaId }: ProductsViewProps) {
  const [luminaires, setLuminaires] = useState(MOCK_LUMINAIRES)
  const [accessories, setAccessories] = useState(MOCK_ACCESSORIES)

  const handleLuminaireQuantityChange = (id: string, delta: number) => {
    setLuminaires((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, quantity: Math.max(p.placed, p.quantity + delta) } : p
      )
    )
  }

  const handleAccessoryQuantityChange = (id: string, delta: number) => {
    setAccessories((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, quantity: Math.max(0, p.quantity + delta) } : p
      )
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Luminaires section */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Luminaires ({luminaires.length})
        </h2>
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <div className="flex gap-3 py-1 px-1">
            {luminaires.map((product) => (
              <LuminaireCard
                key={product.id}
                product={product}
                onSymbolClick={() => console.log('Symbol:', product.id)}
                onTileClick={() => console.log('Tile:', product.id)}
                onQuantityChange={(delta) => handleLuminaireQuantityChange(product.id, delta)}
              />
            ))}
            {/* Add button */}
            <Button
              variant="outline"
              className="w-44 h-auto shrink-0 flex-col gap-2 py-8"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs">Add Luminaire</span>
            </Button>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>

      {/* Accessories section */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Accessories & Drivers ({accessories.length})
        </h2>
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <div className="flex gap-3 py-1 px-1">
            {accessories.map((product) => (
              <AccessoryCard
                key={product.id}
                product={product}
                onAddToTile={() => console.log('Add to tile:', product.id)}
                onQuantityChange={(delta) => handleAccessoryQuantityChange(product.id, delta)}
              />
            ))}
            {/* Add button */}
            <Button
              variant="outline"
              className="w-36 h-auto shrink-0 flex-col gap-2 py-8"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs">Add Accessory</span>
            </Button>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>
    </div>
  )
}
