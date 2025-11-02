'use client';

import React from 'react';
import { ProductInfo } from '@/types/product';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FaPlug } from 'react-icons/fa';
import { FeatureGroupsDisplay } from '../features/FeatureGroupsDisplay';

interface AccessoryLayoutProps {
  product: ProductInfo;
}

export function AccessoryLayout({ product }: AccessoryLayoutProps) {
  // Extract product image
  const productImage = product.multimedia?.find(m => m.mime_code === 'MD01');
  const technicalDrawing = product.multimedia?.find(m => m.mime_code === 'MD12');

  // Check if this is a driver (for compatibility features)
  const isDriver = product.class === 'EC002710';

  return (
    <div className="grid gap-6 lg:grid-cols-[20%_80%]">
      {/* Left side: Compact image (20% visual focus for accessories) */}
      <Card>
        <CardContent className="p-4">
          <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
            {productImage || technicalDrawing ? (
              <Image
                src={(productImage || technicalDrawing)!.mime_source}
                alt={product.description_short}
                fill
                className="object-contain p-4"
                sizes="200px"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <FaPlug className="text-4xl text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Document links */}
          <div className="mt-4 space-y-2">
            {product.multimedia?.filter(m => m.mime_code === 'MD14' || m.mime_code === 'MD22').map((doc, idx) => (
              <a
                key={idx}
                href={doc.mime_source}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 hover:underline"
              >
                📄 {doc.mime_code === 'MD14' ? 'Installation Manual' : 'Spec Sheet'}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Right side: Technical specifications focus */}
      <div className="space-y-6">
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