'use client';

import React, { useState, useCallback } from 'react';
import { logEventClient } from '@fossapp/core/logging/client';
import { Multimedia } from '@fossapp/products/types';
import Image from 'next/image';
import { Card, CardContent } from '@fossapp/ui';
import { Button } from '@fossapp/ui';
import { Badge } from '@fossapp/ui';
import { FaImage, FaFileAlt, FaFilePdf, FaChartArea, FaExternalLinkAlt, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import type { IconType } from 'react-icons';

interface MediaGalleryProps {
  multimedia: Multimedia[];
  productName: string;
}

interface MediaWithFallback {
  primary: Multimedia;
  fallback?: Multimedia;
}

/**
 * Displays all available media for a product as a carousel
 * Combines photos, technical drawings, and photometric data into one slideshow
 */
export function MediaGallery({ multimedia, productName }: MediaGalleryProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  // Helper to get media with fallback, considering failed URLs
  const getMediaWithFallback = (
    primaryCode: string,
    fallbackCode: string
  ): MediaWithFallback | null => {
    const primary = multimedia.find(m => m.mime_code === primaryCode);
    const fallback = multimedia.find(m => m.mime_code === fallbackCode);

    // If primary exists and hasn't failed, use it
    if (primary && !failedUrls.has(primary.mime_source)) {
      return { primary, fallback };
    }
    // If primary failed or doesn't exist, use fallback as primary
    if (fallback) {
      return { primary: fallback };
    }
    return null;
  };

  // Group multimedia by type with fallback support
  // Photos: MD02 (Supabase) -> MD01 (Supplier)
  const md02Photos = multimedia.filter(m => m.mime_code === 'MD02' && !failedUrls.has(m.mime_source));
  const md01Photos = multimedia.filter(m => m.mime_code === 'MD01');
  const productPhotos = md02Photos.length > 0 ? md02Photos : md01Photos;

  // Drawing: MD64 (Supabase) -> MD12 (Supplier)
  const drawingWithFallback = getMediaWithFallback('MD64', 'MD12');

  // Photometric: MD19 (Supabase) -> MD16 (Supplier)
  const photometricWithFallback = getMediaWithFallback('MD19', 'MD16');

  const productLink = multimedia.find(m => m.mime_code === 'MD04');
  const manual = multimedia.find(m => m.mime_code === 'MD14');
  const specsheet = multimedia.find(m => m.mime_code === 'MD22');

  // Handle image load error - mark URL as failed and trigger re-render
  const handleImageError = useCallback((url: string) => {
    setFailedUrls(prev => {
      const newSet = new Set(prev);
      newSet.add(url);
      return newSet;
    });
  }, []);

  // Build carousel slides with fallback info
  const carouselSlides: Array<{
    media: Multimedia;
    fallback?: Multimedia;
    label: string;
    type: 'photo' | 'drawing' | 'photometric'
  }> = [
    ...productPhotos.map((photo, idx) => ({
      media: photo,
      fallback: photo.mime_code === 'MD02' ? md01Photos[idx] || md01Photos[0] : undefined,
      label: productPhotos.length > 1 ? `Photo ${idx + 1}` : 'Product Photo',
      type: 'photo' as const
    })),
    ...(drawingWithFallback ? [{
      media: drawingWithFallback.primary,
      fallback: drawingWithFallback.fallback,
      label: 'Technical Drawing',
      type: 'drawing' as const
    }] : []),
    ...(photometricWithFallback ? [{
      media: photometricWithFallback.primary,
      fallback: photometricWithFallback.fallback,
      label: 'Photometric Data',
      type: 'photometric' as const
    }] : [])
  ];

  const hasCarousel = carouselSlides.length > 0;
  const currentMedia = carouselSlides[currentSlide];

  const logImageView = useCallback((slideIndex: number, action: string) => {
    const slide = carouselSlides[slideIndex];
    if (slide) {
      logEventClient('product_image_viewed', {
        product_name: productName,
        media_type: slide.type,
        media_label: slide.label,
        slide_index: slideIndex,
        total_slides: carouselSlides.length,
        action,
      });
    }
  }, [carouselSlides, productName]);

  const nextSlide = useCallback(() => {
    const newIndex = (currentSlide + 1) % carouselSlides.length;
    setCurrentSlide(newIndex);
    logImageView(newIndex, 'next');
  }, [currentSlide, carouselSlides.length, logImageView]);

  const prevSlide = useCallback(() => {
    const newIndex = (currentSlide - 1 + carouselSlides.length) % carouselSlides.length;
    setCurrentSlide(newIndex);
    logImageView(newIndex, 'prev');
  }, [currentSlide, carouselSlides.length, logImageView]);

  const handleThumbnailClick = useCallback((idx: number) => {
    setCurrentSlide(idx);
    logImageView(idx, 'thumbnail');
  }, [logImageView]);

  const getMediaIcon = (type: 'photo' | 'drawing' | 'photometric') => {
    switch (type) {
      case 'photo': return FaImage;
      case 'drawing': return FaFileAlt;
      case 'photometric': return FaChartArea;
    }
  };

  const renderDocumentButton = (media: Multimedia, label: string, icon: IconType) => {
    return (
      <Button
        key={media.mime_code}
        variant="outline"
        className="flex items-center gap-2 w-full justify-start"
        onClick={() => window.open(media.mime_source, '_blank')}
      >
        {React.createElement(icon, { className: 'h-4 w-4' })}
        <span className="text-sm">{label}</span>
        <FaExternalLinkAlt className="h-3 w-3 ml-auto" />
      </Button>
    );
  };

  return (
    <Card>
      <CardContent className="p-6">
        {/* Carousel Container */}
        {hasCarousel ? (
          <>
            {/* Main Carousel Display - Improved aspect ratio with max-height */}
            <div className="relative group">
              <div className="aspect-4/3 max-h-[500px] relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
                <Image
                  src={currentMedia.media.mime_source}
                  alt={currentMedia.label}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 60vw"
                  priority={currentSlide === 0}
                  onError={() => handleImageError(currentMedia.media.mime_source)}
                />

                {/* Media Type Badge */}
                <div className="absolute top-3 left-3">
                  <Badge className="flex items-center gap-1.5 bg-background/90! text-foreground! border! border-border/50! backdrop-blur-xs shadow-xs">
                    {React.createElement(getMediaIcon(currentMedia.type), { className: 'h-3 w-3' })}
                    {currentMedia.label}
                  </Badge>
                </div>

                {/* Slide Counter */}
                {carouselSlides.length > 1 && (
                  <div className="absolute top-3 right-3">
                    <Badge variant="secondary" className="bg-black/60 text-white">
                      {currentSlide + 1} / {carouselSlides.length}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Navigation Arrows - Only show if multiple slides */}
              {carouselSlides.length > 1 && (
                <>
                  <button
                    onClick={prevSlide}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Previous slide"
                  >
                    <FaChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Next slide"
                  >
                    <FaChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Navigation - Only show if multiple slides */}
            {carouselSlides.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {carouselSlides.map((slide, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleThumbnailClick(idx)}
                    className={`shrink-0 w-20 h-20 border-2 rounded overflow-hidden transition-all ${
                      currentSlide === idx
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50'
                    }`}
                    title={slide.label}
                  >
                    <div className="relative w-full h-full bg-gray-100 dark:bg-gray-900">
                      <Image
                        src={slide.media.mime_source}
                        alt={slide.label}
                        fill
                        className="object-cover"
                        sizes="80px"
                        onError={() => handleImageError(slide.media.mime_source)}
                      />
                      {/* Small icon indicator for non-photo slides */}
                      {slide.type !== 'photo' && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          {React.createElement(getMediaIcon(slide.type), {
                            className: 'h-6 w-6 text-white'
                          })}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="aspect-4/3 max-h-[500px] flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-900">
            <span className="text-muted-foreground">No media available</span>
          </div>
        )}

        {/* Additional Document Resources */}
        {(productLink || manual || specsheet) && (
          <div className="mt-6 space-y-2">
            <div className="text-sm font-medium mb-3">Documentation</div>
            {manual && renderDocumentButton(manual, 'Installation Manual', FaFilePdf)}
            {specsheet && renderDocumentButton(specsheet, 'Specification Sheet', FaFilePdf)}
            {productLink && renderDocumentButton(productLink, 'Manufacturer Page', FaExternalLinkAlt)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
