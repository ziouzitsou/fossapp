'use client';

import React from 'react';
import { ProductInfo } from '@/types/product';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FeatureGroupsDisplay } from '../features/FeatureGroupsDisplay';

interface LuminaireLayoutProps {
  product: ProductInfo;
}

export function LuminaireLayout({ product }: LuminaireLayoutProps) {
  // Extract first product image
  const productImage = product.multimedia?.find(m => m.mime_code === 'MD01');

  return (
    <div className="grid gap-6 lg:grid-cols-[60%_40%]">
      {/* Left side: Large image gallery (60% visual focus for luminaires) */}
      <Card>
        <CardContent className="p-6">
          <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
            {productImage ? (
              <Image
                src={productImage.mime_source}
                alt={product.description_short}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 60vw"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-muted-foreground">No image available</span>
              </div>
            )}
          </div>

          {/* Thumbnail gallery placeholder */}
          <div className="mt-4 flex gap-2">
            {product.multimedia?.slice(0, 4).map((media, idx) => (
              <div
                key={idx}
                className="w-20 h-20 border rounded bg-gray-50 dark:bg-gray-900"
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Right side: Smart feature groups with priority for lighting */}
      <div className="space-y-6">
        {/* Use smart feature grouping system */}
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