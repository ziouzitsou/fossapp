'use client';

import React from 'react';
import { ProductInfo } from '@fossapp/products/types';
import { Card, CardContent } from '@fossapp/ui';
import { Badge } from '@fossapp/ui';
import { FeatureGroupsDisplay } from '../features/FeatureGroupsDisplay';
import { MediaGallery } from '../media/MediaGallery';
import { MarkdownDescription } from '@fossapp/ui';

interface GenericLayoutProps {
  product: ProductInfo;
}

export function GenericLayout({ product }: GenericLayoutProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[30%_70%]">
      {/* Left side: Media gallery (30% for generic) */}
      <div className="space-y-4">
        <MediaGallery
          multimedia={product.multimedia || []}
          productName={product.description_short}
        />

        {/* Basic product info */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
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
      </div>

      {/* Right side: All specifications equally weighted */}
      <div className="space-y-6">
        {/* Description */}
        {product.description_long && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-2">Description</h3>
              <MarkdownDescription content={product.description_long} />
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