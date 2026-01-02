'use client'

/**
 * Symbol Gallery Component
 * Displays PNG (DWG screenshot) and SVG with carousel navigation
 * Modeled after the Product Media carousel pattern
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Code2, Image as ImageIcon, ChevronLeft, ChevronRight, Sparkles, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@fossapp/ui'

/**
 * Calculate a "nice" scale bar value based on the boundary size
 * Returns a round number that's roughly 20-30% of the boundary
 */
function getScaleBarValue(boundaryMm: number): number {
  const targetWidth = boundaryMm * 0.33 // Target ~1/3 of width
  const niceValues = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]
  return niceValues.reduce((prev, curr) =>
    Math.abs(curr - targetWidth) < Math.abs(prev - targetWidth) ? curr : prev
  )
}

/**
 * Extract boundary dimension from SVG content
 * Tries data-boundary-mm attribute first, then falls back to viewBox
 */
function extractBoundaryFromSvg(svgText: string): number | null {
  // Try data-boundary-mm attribute first
  const boundaryMatch = svgText.match(/data-boundary-mm="(\d+(?:\.\d+)?)"/)
  if (boundaryMatch) {
    return parseFloat(boundaryMatch[1])
  }

  // Fallback to viewBox (assumes square or takes max dimension)
  const viewBoxMatch = svgText.match(/viewBox="0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"/)
  if (viewBoxMatch) {
    const width = parseFloat(viewBoxMatch[1])
    const height = parseFloat(viewBoxMatch[2])
    return Math.max(width, height)
  }

  return null
}

// Supabase storage URL for product-symbols bucket
const SYMBOLS_BUCKET_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-symbols`

interface SymbolSlide {
  type: 'png' | 'svg'
  label: string
  url: string
}

interface SymbolGalleryProps {
  /** Product ID for alt text */
  fossPid: string
  /** Path to PNG in storage */
  pngPath?: string | null
  /** Path to SVG in storage */
  svgPath?: string | null
  /** Whether delete is in progress */
  isDeleting?: boolean
  /** Delete state for two-step confirmation */
  deleteState?: 'idle' | 'confirming' | 'deleting'
  /** Callback when delete button clicked */
  onDelete?: () => void
}

export function SymbolGallery({
  fossPid,
  pngPath,
  svgPath,
  isDeleting = false,
  deleteState = 'idle',
  onDelete,
}: SymbolGalleryProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [svgDataUrl, setSvgDataUrl] = useState<string | null>(null)
  const [boundaryMm, setBoundaryMm] = useState<number | null>(null)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Fetch SVG and convert to data URL for safe rendering
  useEffect(() => {
    if (!svgPath) {
      setSvgDataUrl(null)
      setBoundaryMm(null)
      return
    }

    const fetchSvg = async () => {
      try {
        // Add cache-busting to prevent stale SVG content
        const url = `${SYMBOLS_BUCKET_URL}/${svgPath}?t=${Date.now()}`
        const response = await fetch(url)
        if (response.ok) {
          const text = await response.text()
          // Convert to data URL for safe XSS-free rendering
          const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`
          setSvgDataUrl(dataUrl)

          // Extract boundary dimension for scale bar
          const boundary = extractBoundaryFromSvg(text)
          setBoundaryMm(boundary)
        }
      } catch {
        // Ignore fetch errors
      }
    }

    fetchSvg()
  }, [svgPath])

  // Track container size for scale bar calculation
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      // Use the image element if available to get actual rendered size
      const img = imageRef.current
      if (img && img.naturalWidth > 0) {
        // Calculate the actual displayed size (accounting for object-contain and padding)
        const containerRect = container.getBoundingClientRect()
        const padding = 16 * 2 // p-4 = 1rem = 16px on each side
        const availableWidth = containerRect.width - padding
        const availableHeight = containerRect.height - padding

        // object-contain scales to fit while maintaining aspect ratio
        const imgAspect = img.naturalWidth / img.naturalHeight
        const containerAspect = availableWidth / availableHeight

        let displayedWidth: number
        if (imgAspect > containerAspect) {
          // Image is wider than container - width is the constraint
          displayedWidth = availableWidth
        } else {
          // Image is taller than container - height is the constraint
          displayedWidth = availableHeight * imgAspect
        }

        setContainerSize({ width: displayedWidth, height: displayedWidth / imgAspect })
      } else {
        // Fallback to container size
        const rect = container.getBoundingClientRect()
        setContainerSize({ width: rect.width - 32, height: rect.height - 32 })
      }
    }

    // Initial measurement
    updateSize()

    // ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(container)

    // Also update when image loads
    const img = imageRef.current
    if (img) {
      img.addEventListener('load', updateSize)
    }

    return () => {
      resizeObserver.disconnect()
      if (img) {
        img.removeEventListener('load', updateSize)
      }
    }
  }, [svgDataUrl])

  // Build slides array
  const slides: SymbolSlide[] = []

  // PNG slide (DWG screenshot)
  if (pngPath) {
    slides.push({
      type: 'png',
      label: 'DWG Screenshot',
      url: `${SYMBOLS_BUCKET_URL}/${pngPath}?t=${Date.now()}`,
    })
  }

  // SVG slide (web vector)
  if (svgPath && svgDataUrl) {
    slides.push({
      type: 'svg',
      label: 'SVG Vector',
      url: svgDataUrl,
    })
  }

  // Navigation handlers
  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }, [slides.length])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }, [slides.length])

  // Ensure currentSlide is valid
  const safeSlideIndex = Math.min(currentSlide, Math.max(0, slides.length - 1))
  const currentMedia = slides[safeSlideIndex]
  const hasSlides = slides.length > 0

  // Empty state
  if (!hasSlides) {
    return (
      <div className="relative aspect-square rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Sparkles className="w-12 h-12" />
          <p className="text-sm">No symbol generated</p>
          <p className="text-xs text-center px-4">
            Click the button below to generate a CAD symbol
          </p>
        </div>
      </div>
    )
  }

  // Calculate scale bar dimensions
  const showScaleBar = currentMedia?.type === 'svg' && boundaryMm && containerSize
  const scaleBarValue = boundaryMm ? getScaleBarValue(boundaryMm) : 0
  const scaleBarPixels = showScaleBar && boundaryMm
    ? (scaleBarValue / boundaryMm) * containerSize.width
    : 0

  return (
    <div
      ref={containerRef}
      className="relative aspect-square rounded-lg border overflow-hidden bg-zinc-800 flex items-center justify-center"
    >
      {/* Main Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={currentMedia.url}
        alt={`${fossPid} - ${currentMedia.label}`}
        className="max-w-full max-h-full object-contain p-4"
      />

      {/* Map-style Scale Bar - Only for SVG slides */}
      {showScaleBar && scaleBarPixels > 0 && (
        <div className="absolute top-3 left-3">
          {/* Semitransparent container with rounded corners */}
          <div
            className="bg-black/30 backdrop-blur-sm rounded-md px-2.5 py-2 flex flex-col gap-1"
            style={{ width: `${Math.max(scaleBarPixels, 50) + 20}px` }}
          >
            {/* Scale bar with end caps */}
            <div className="relative h-2.5 w-full">
              <svg
                width="100%"
                height="100%"
                className="absolute inset-0"
                preserveAspectRatio="none"
              >
                {/* Left end cap */}
                <line x1="0.5" y1="0" x2="0.5" y2="100%" stroke="white" strokeOpacity="0.8" strokeWidth="1" />
                {/* Horizontal bar */}
                <line x1="0" y1="100%" x2="100%" y2="100%" stroke="white" strokeOpacity="0.8" strokeWidth="1" />
                {/* Right end cap */}
                <line x1="calc(100% - 0.5px)" y1="0" x2="calc(100% - 0.5px)" y2="100%" stroke="white" strokeOpacity="0.8" strokeWidth="1" />
                {/* Middle tick */}
                <line x1="50%" y1="40%" x2="50%" y2="100%" stroke="white" strokeOpacity="0.5" strokeWidth="1" />
              </svg>
            </div>
            {/* Labels: 0 on left, value on right */}
            <div className="flex justify-between w-full">
              <span className="text-[9px] text-white/70 font-medium tabular-nums leading-none">0</span>
              <span className="text-[9px] text-white/70 font-medium tabular-nums leading-none">{scaleBarValue} mm</span>
            </div>
          </div>
        </div>
      )}

      {/* Media Type Label - Bottom Left (like Product Media) */}
      <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs flex items-center gap-1.5">
        {currentMedia.type === 'svg' ? (
          <Code2 className="w-3 h-3" />
        ) : (
          <ImageIcon className="w-3 h-3" />
        )}
        {currentMedia.label}
      </div>

      {/* Navigation Arrows (when multiple slides) */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dots indicator - Bottom Right */}
          <div className="absolute bottom-2 right-2 flex gap-1">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  idx === safeSlideIndex ? 'bg-white' : 'bg-white/50'
                )}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Delete Button - Top Right */}
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={isDeleting || deleteState === 'deleting'}
          className={cn(
            'absolute top-2 right-2 p-1.5 rounded-md transition-colors',
            deleteState === 'idle' && 'text-white/70 hover:text-red-400 hover:bg-red-500/20',
            deleteState === 'confirming' && 'text-red-400 bg-red-500/20 animate-pulse',
            deleteState === 'deleting' && 'text-white/50 cursor-not-allowed'
          )}
          title={deleteState === 'confirming' ? 'Click again to confirm' : 'Delete symbol'}
        >
          {deleteState === 'deleting' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  )
}
