'use client'

/**
 * Symbol Gallery Component
 * Displays PNG (DWG screenshot) and SVG with carousel navigation
 * Modeled after the Product Media carousel pattern
 */

import { useState, useCallback, useEffect } from 'react'
import { Code2, Image as ImageIcon, ChevronLeft, ChevronRight, Sparkles, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@fossapp/ui'

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

  // Fetch SVG and convert to data URL for safe rendering
  useEffect(() => {
    if (!svgPath) {
      setSvgDataUrl(null)
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
        }
      } catch {
        // Ignore fetch errors
      }
    }

    fetchSvg()
  }, [svgPath])

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

  return (
    <div className="relative aspect-square rounded-lg border overflow-hidden bg-zinc-800 flex items-center justify-center">
      {/* Main Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentMedia.url}
        alt={`${fossPid} - ${currentMedia.label}`}
        className="max-w-full max-h-full object-contain p-4"
      />

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
