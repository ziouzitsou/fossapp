'use client';

import React, { useState } from 'react';
import { Multimedia } from '@/types/product';
import { MIME_CODES } from '@/types/product';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FaImage, FaFileAlt, FaFilePdf, FaChartArea, FaExternalLinkAlt, FaDownload } from 'react-icons/fa';

interface MediaGalleryProps {
  multimedia: Multimedia[];
  productName: string;
}

/**
 * Displays all available media for a product
 * Only shows media types that exist in the multimedia array
 */
export function MediaGallery({ multimedia, productName }: MediaGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<Multimedia | null>(null);

  // Group multimedia by type
  const productPhotos = multimedia.filter(m => m.mime_code === 'MD01');
  const technicalDrawing = multimedia.find(m => m.mime_code === 'MD12');
  const photometric = multimedia.find(m => m.mime_code === 'MD16');
  const productLink = multimedia.find(m => m.mime_code === 'MD04');
  const manual = multimedia.find(m => m.mime_code === 'MD14');
  const specsheet = multimedia.find(m => m.mime_code === 'MD22');

  // Set initial selected image
  React.useEffect(() => {
    if (productPhotos.length > 0 && !selectedImage) {
      setSelectedImage(productPhotos[0]);
    }
  }, [productPhotos, selectedImage]);

  const getMediaIcon = (code: string) => {
    switch (code) {
      case 'MD01': return FaImage;
      case 'MD12': return FaFileAlt;
      case 'MD16': return FaChartArea;
      case 'MD04': return FaExternalLinkAlt;
      case 'MD14': return FaFilePdf;
      case 'MD22': return FaFilePdf;
      default: return FaFileAlt;
    }
  };

  const renderMediaButton = (media: Multimedia, label: string) => {
    const Icon = getMediaIcon(media.mime_code);
    const isLink = media.mime_code === 'MD04';
    const isDocument = ['MD14', 'MD22', 'MD16'].includes(media.mime_code);

    return (
      <Button
        key={media.mime_code}
        variant="outline"
        className="flex items-center gap-2 w-full justify-start"
        onClick={() => {
          if (isLink || isDocument) {
            window.open(media.mime_source, '_blank');
          }
        }}
      >
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
        {(isLink || isDocument) && <FaExternalLinkAlt className="h-3 w-3 ml-auto" />}
      </Button>
    );
  };

  return (
    <Card>
      <CardContent className="p-6">
        {/* Main image display */}
        <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 mb-4">
          {selectedImage ? (
            <Image
              src={selectedImage.mime_source}
              alt={productName}
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

        {/* Photo thumbnails */}
        {productPhotos.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {productPhotos.map((photo, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(photo)}
                className={`flex-shrink-0 w-20 h-20 border-2 rounded overflow-hidden ${
                  selectedImage === photo
                    ? 'border-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Image
                  src={photo.mime_source}
                  alt={`${productName} - view ${idx + 1}`}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                />
              </button>
            ))}
          </div>
        )}

        {/* Technical Drawing */}
        {technicalDrawing && (
          <div className="mb-2">
            <button
              onClick={() => setSelectedImage(technicalDrawing)}
              className={`w-full p-3 border-2 rounded flex items-center gap-3 hover:bg-accent transition-colors ${
                selectedImage === technicalDrawing
                  ? 'border-primary bg-accent'
                  : 'border-border'
              }`}
            >
              <FaFileAlt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div className="text-left">
                <div className="font-medium text-sm">Technical Drawing</div>
                <div className="text-xs text-muted-foreground">SVG/CAD format</div>
              </div>
            </button>
          </div>
        )}

        {/* Additional Resources */}
        {(photometric || productLink || manual || specsheet) && (
          <div className="mt-4 space-y-2">
            <div className="text-sm font-medium mb-2">Additional Resources</div>
            {photometric && renderMediaButton(photometric, 'Photometric Data')}
            {manual && renderMediaButton(manual, 'Installation Manual')}
            {specsheet && renderMediaButton(specsheet, 'Specification Sheet')}
            {productLink && renderMediaButton(productLink, 'Manufacturer Page')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
