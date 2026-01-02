/**
 * Product Layout Router - Renders product-type-specific layouts
 *
 * Selects the appropriate display layout based on the product's template type.
 * Each layout is optimized for its product category with relevant feature sections.
 *
 * @remarks
 * **Available layouts**:
 * - `luminaire`: Light output specs, beam angles, electrical info
 * - `accessory`: Compatibility info, materials, dimensions
 * - `lightline`: Linear lighting specs (length, profiles)
 * - `generic`: Fallback for all other product types
 *
 * @see {@link determineTemplateType} for how template type is detected
 */
import React from 'react';
import { ProductInfo, TemplateType } from '@fossapp/products/types';
import { LuminaireLayout } from './LuminaireLayout';
import { AccessoryLayout } from './AccessoryLayout';
import { LightLineLayout } from './LightLineLayout';
import { GenericLayout } from './GenericLayout';

/**
 * Props for the ProductLayout component.
 */
interface ProductLayoutProps {
  product: ProductInfo;
  templateType: TemplateType;
}

/**
 * Smart layout selector that renders the appropriate layout based on template type
 * This component acts as a router for different product display templates
 */
export function ProductLayout({ product, templateType }: ProductLayoutProps) {
  switch (templateType) {
    case 'luminaire':
      return <LuminaireLayout product={product} />;

    case 'accessory':
      return <AccessoryLayout product={product} />;

    case 'lightline':
      return <LightLineLayout product={product} />;

    case 'generic':
    default:
      return <GenericLayout product={product} />;
  }
}