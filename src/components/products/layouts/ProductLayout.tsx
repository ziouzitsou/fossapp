import React from 'react';
import { ProductInfo, TemplateType } from '@/types/product';
import { LuminaireLayout } from './LuminaireLayout';
import { AccessoryLayout } from './AccessoryLayout';
import { LightLineLayout } from './LightLineLayout';
import { GenericLayout } from './GenericLayout';

interface ProductLayoutProps {
  product: ProductInfo;
  templateType: TemplateType;
}

/**
 * Smart layout selector that renders the appropriate layout based on template type
 * This component acts as a router for different product display templates
 */
export function ProductLayout({ product, templateType }: ProductLayoutProps) {
  // Log template selection in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ProductLayout] Rendering ${templateType} template for class ${product.class}`);
  }

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