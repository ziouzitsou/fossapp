'use client';

import React from 'react';
import { ProductInfo } from '@/types/product';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FaLink } from 'react-icons/fa';
import { FeatureGroupsDisplay } from '../features/FeatureGroupsDisplay';

interface LightLineLayoutProps {
  product: ProductInfo;
}

export function LightLineLayout({ product }: LightLineLayoutProps) {
  const productImage = product.multimedia?.find(m => m.mime_code === 'MD01');

  // Extract track-specific features
  const trackType = product.features?.find(f =>
    f.feature_name?.toLowerCase().includes('track') ||
    f.feature_name?.toLowerCase().includes('rail')
  );

  // For light-emitting units, check for light characteristics
  const hasLight = product.features?.some(f => f.FEATUREID === 'EF001742'); // Has lumens

  return (
    <div className="grid gap-6 lg:grid-cols-[40%_60%]">
      {/* Left side: Medium image focus (40% for light-line) */}
      <Card>
        <CardContent className="p-6">
          <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
            {productImage ? (
              <Image
                src={productImage.mime_source}
                alt={product.description_short}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 40vw"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <FaLink className="text-4xl text-muted-foreground mb-2" />
                <span className="text-muted-foreground">Track System Component</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right side: System information and specs */}
      <div className="space-y-6">
        {/* System Compatibility Indicator */}
        <Card className="border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FaLink className="text-purple-600" />
              <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100">
                Track System Component
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              This component is designed for track/rail lighting systems.
              Ensure compatibility with your existing track infrastructure.
            </p>
            {trackType && (
              <Badge variant="outline" className="text-purple-600">
                {trackType.fvalueC_desc || trackType.feature_name}
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Smart Feature Groups - Balance electrical and light features */}
        <FeatureGroupsDisplay
          product={product}
          showQuickView={true}
          defaultExpandedGroups={
            hasLight
              ? ['EFG00009', 'EFG00006'] // Light technical and Electrical for light-emitting
              : ['EFG00006', 'EFG00011'] // Electrical and Dimensions for non-emitting
          }
        />

        {/* Installation notes */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-2">Installation</h3>
            <p className="text-sm text-muted-foreground">
              Professional installation recommended. This component requires a compatible
              track system. Check voltage and phase compatibility before installation.
            </p>
          </CardContent>
        </Card>

        {/* Price */}
        {product.prices?.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">
                €{product.prices[0].start_price}
              </div>
              {product.prices[0].disc1 > 0 && (
                <Badge variant="secondary" className="mt-2">
                  -{product.prices[0].disc1}% trade discount
                </Badge>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}