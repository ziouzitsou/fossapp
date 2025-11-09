'use client';

import React from 'react';
import { ProductInfo } from '@/types/product';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FeatureGroupsDisplay } from '../features/FeatureGroupsDisplay';
import { MediaGallery } from '../media/MediaGallery';

interface LuminaireLayoutProps {
  product: ProductInfo;
}

export function LuminaireLayout({ product }: LuminaireLayoutProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[55%_45%]">
      {/* Left side: Media carousel with photos, drawings, and photometric data */}
      <MediaGallery
        multimedia={product.multimedia || []}
        productName={product.description_short}
      />

      {/* Right side: Description and specifications */}
      <div className="space-y-6">
        {/* Long Description */}
        {product.description_long && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {product.description_long}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Smart feature groups with priority for lighting */}
        <FeatureGroupsDisplay
          product={product}
          showQuickView={true}
          defaultExpandedGroups={['EFG00009', 'EFG00006']} // Light technical and Electrical
        />

        {/* Price */}
        {product.prices?.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">
                €{product.prices[0].start_price}
              </div>
              {product.prices[0].disc1 > 0 && (
                <Badge variant="secondary" className="mt-2">
                  -{product.prices[0].disc1}% discount available
                </Badge>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}