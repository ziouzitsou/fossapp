'use client';

import React from 'react';
import { ProductInfo } from '@/types/product';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FeatureGroupsDisplay } from '../features/FeatureGroupsDisplay';
import { MediaGallery } from '../media/MediaGallery';
import { MarkdownDescription } from '@/components/ui/markdown-description';

interface AccessoryLayoutProps {
  product: ProductInfo;
}

export function AccessoryLayout({ product }: AccessoryLayoutProps) {
  // Check if this is a driver (for compatibility features)
  const isDriver = product.class === 'EC002710';

  return (
    <div className="grid gap-6 lg:grid-cols-[30%_70%]">
      {/* Left side: Media gallery (30% for accessories) */}
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
              <MarkdownDescription content={product.description_long} />
            </CardContent>
          </Card>
        )}

        {/* Compatibility Finder (for drivers) */}
        {isDriver && (
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-green-900 dark:text-green-100 mb-2">
                Compatible Products
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                This driver can power luminaires with matching voltage and power requirements.
              </p>
              <Badge variant="outline" className="text-green-600">
                Compatibility finder coming soon
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* Smart Feature Groups with electrical priority */}
        <FeatureGroupsDisplay
          product={product}
          showQuickView={true}
          defaultExpandedGroups={['EFG00006', 'EFG00020', 'EFG00011']} // Electrical, Safety, Dimensions
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
                  -{product.prices[0].disc1}% professional discount
                </Badge>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}