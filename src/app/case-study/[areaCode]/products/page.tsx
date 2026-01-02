'use client'

import { useState, useCallback } from 'react'
import { ProductsView } from '../../components/products-view'
import { useCaseStudyContext } from '../case-study-shell'
import { SymbolModal } from '@/components/symbols'
import type { AreaRevisionProduct } from '@/lib/actions/areas/revision-products-actions'
import type { LuminaireProduct } from '../../types'

/**
 * Adapt case-study LuminaireProduct to AreaRevisionProduct format
 * for use with SymbolModal.
 */
function toAreaRevisionProduct(product: LuminaireProduct): AreaRevisionProduct {
  // Symbol paths follow format: {foss_pid}/{foss_pid}-SYMBOL.{ext}
  const pngPath = product.hasSymbolDrawing
    ? `${product.code}/${product.code}-SYMBOL.png`
    : undefined
  const svgPath = product.hasSymbolDrawing
    ? `${product.code}/${product.code}-SYMBOL.svg`
    : undefined

  return {
    id: product.id,
    product_id: product.productId,
    foss_pid: product.code,
    description_short: product.name,
    quantity: product.quantity,
    status: 'active',
    symbol_code: product.symbolLetter,
    symbol_sequence: product.symbolSequence,
    symbol: product.symbol,
    symbol_png_path: pngPath,
    symbol_svg_path: svgPath,
  }
}

/**
 * Products View Page
 * Route: /case-study/[areaCode]/products
 *
 * Shows horizontal scrolling product cards for luminaires and accessories.
 */
export default function ProductsPage() {
  const { state } = useCaseStudyContext()

  // Symbol modal state
  const [symbolModalOpen, setSymbolModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<AreaRevisionProduct | null>(null)

  const handleSymbolClick = useCallback((id: string) => {
    const product = state.luminaires.find(p => p.id === id)
    if (product) {
      setSelectedProduct(toAreaRevisionProduct(product))
      setSymbolModalOpen(true)
    }
  }, [state.luminaires])

  const handleSymbolGenerated = useCallback(() => {
    // TODO: Add refresh to context to update hasSymbolDrawing status
    console.log('[CaseStudy] Symbol generated - refresh needed')
  }, [])

  return (
    <>
      <ProductsView
        luminaires={state.luminaires}
        accessories={state.accessories}
        onLuminaireQuantityChange={state.updateLuminaireQuantity}
        onAccessoryQuantityChange={state.updateAccessoryQuantity}
        onSymbolClick={handleSymbolClick}
        onTileClick={(id) => console.log('Tile modal:', id)}
        onAddToTile={(id) => console.log('Add to tile:', id)}
      />

      <SymbolModal
        product={selectedProduct}
        open={symbolModalOpen}
        onOpenChange={setSymbolModalOpen}
        onSymbolGenerated={handleSymbolGenerated}
      />
    </>
  )
}
