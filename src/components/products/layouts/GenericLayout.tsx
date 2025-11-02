'use client';

import React from 'react';
import { ProductInfo } from '@/types/product';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FeatureGroupsDisplay } from '../features/FeatureGroupsDisplay';

interface GenericLayoutProps {
  product: ProductInfo;
}

export function GenericLayout({ product }: GenericLayoutProps) {
  const productImage = product.multimedia?.find(m => m.mime_code === 'MD01');

  return (
    <div className="grid gap-6 lg:grid-cols-[30%_70%]">
      {/* Left side: Basic image (30% for generic) */}
      <Card>
        <CardContent className="p-6">
          <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
            {productImage ? (
              <Image
                src={productImage.mime_source}
                alt={product.description_short}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 30vw"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-muted-foreground">No image available</span>
              </div>
            )}
          </div>

          {/* Basic product info */}
          <div className="mt-4 space-y-2">
            <div>
              <div className="text-xs text-muted-foreground">Model</div>
              <div className="font-mono text-sm">{product.foss_pid}</div>
            </div>
            {product.manufacturer_pid && (
              <div>
                <div className="text-xs text-muted-foreground">Manufacturer ID</div>
                <div className="font-mono text-sm">{product.manufacturer_pid}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right side: All specifications equally weighted */}
      <div className="space-y-6">
        {/* Description */}
        {product.description_long && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">
                {product.description_long}
              </p>
            </CardContent>
          </Card>
        )}

        {/* All feature groups with equal priority */}
        <FeatureGroupsDisplay
          product={product}
          showQuickView={true}
          defaultExpandedGroups={[]} // No default expanded groups for generic
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
                  -{product.prices[0].disc1}% discount
                </Badge>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}