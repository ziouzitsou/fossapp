'use client'

import { ProductsView } from '../../components/products-view'
import { useCaseStudyContext } from '../case-study-shell'

/**
 * Products View Page
 * Route: /case-study/[areaCode]/products
 *
 * Shows horizontal scrolling product cards for luminaires and accessories.
 */
export default function ProductsPage() {
  const { state } = useCaseStudyContext()

  return (
    <ProductsView
      luminaires={state.luminaires}
      accessories={state.accessories}
      onLuminaireQuantityChange={state.updateLuminaireQuantity}
      onAccessoryQuantityChange={state.updateAccessoryQuantity}
      onSymbolClick={(id) => console.log('Symbol modal:', id)}
      onTileClick={(id) => console.log('Tile modal:', id)}
      onAddToTile={(id) => console.log('Add to tile:', id)}
    />
  )
}
