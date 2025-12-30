'use client'

/**
 * Symbol Modal Component
 * Modal for viewing/generating product symbol drawings
 * Shows product photo, technical drawing, dimensions, and generated symbol
 */

import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@fossapp/ui'
import { Badge, Button } from '@fossapp/ui'
import { cn } from '@fossapp/ui'
import { Sparkles, Loader2, RefreshCw, Image as ImageIcon, Ruler, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import type { AreaRevisionProduct } from '@/lib/actions/areas/revision-products-actions'
import { SymbolProgress } from './symbol-progress'
import { SymbolGallery } from './symbol-gallery'
import { extractDimensions } from '@/lib/symbol-generator/dimension-utils'
import type { ProductInfo, Feature } from '@fossapp/products/types'
import { hasDisplayableValue, getFeatureDisplayValue, FEATURE_GROUP_CONFIG } from '@/lib/utils/feature-utils'
import { deleteProductSymbolAction } from '@/lib/actions/symbols'

interface SymbolModalProps {
  product: AreaRevisionProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSymbolGenerated?: () => void  // Callback when symbol is saved
}

type GenerationStep = 'idle' | 'fetching' | 'analyzing' | 'generating' | 'done' | 'error'

// Media slide type for carousel
interface MediaSlide {
  url: string
  fallbackUrl?: string
  label: string
  type: 'photo' | 'drawing'
}

export function SymbolModal({ product, open, onOpenChange, onSymbolGenerated }: SymbolModalProps) {
  const [step, setStep] = useState<GenerationStep>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatedPngPath, setGeneratedPngPath] = useState<string | null>(null)
  const [generatedSvgPath, setGeneratedSvgPath] = useState<string | null>(null)

  // Product preview state
  const [fullProduct, setFullProduct] = useState<ProductInfo | null>(null)
  const [loadingProduct, setLoadingProduct] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set())

  // Delete confirmation state (two-step: idle -> confirming -> deleting)
  const [deleteState, setDeleteState] = useState<'idle' | 'confirming' | 'deleting'>('idle')
  const [symbolCleared, setSymbolCleared] = useState(false)

  // Reset state when modal opens with different product
  useEffect(() => {
    if (open && product) {
      setStep('idle')
      setJobId(null)
      setError(null)
      setGeneratedPngPath(null)
      setGeneratedSvgPath(null)
      setFullProduct(null)
      setCurrentSlide(0)
      setFailedUrls(new Set())
      setDeleteState('idle')
      setSymbolCleared(false)

      // Fetch full product info for preview
      fetchProductInfo(product.product_id)
    }
  }, [open, product?.id])

  // Fetch full product info for preview
  const fetchProductInfo = async (productId: string) => {
    setLoadingProduct(true)
    try {
      const response = await fetch(`/api/products/${productId}`)
      if (response.ok) {
        const { data } = await response.json() as { data: ProductInfo }
        setFullProduct(data)
      }
    } catch (err) {
      console.error('Failed to fetch product info:', err)
    } finally {
      setLoadingProduct(false)
    }
  }

  // Get media with fallback
  const getMediaUrl = (primaryCode: string, fallbackCode: string): { url: string; fallbackUrl?: string } | null => {
    if (!fullProduct?.multimedia) return null

    const primary = fullProduct.multimedia.find(m => m.mime_code === primaryCode)
    const fallback = fullProduct.multimedia.find(m => m.mime_code === fallbackCode)

    if (primary && !failedUrls.has(primary.mime_source)) {
      return { url: primary.mime_source, fallbackUrl: fallback?.mime_source }
    }
    if (fallback) {
      return { url: fallback.mime_source }
    }
    return null
  }

  // Build media slides
  const buildMediaSlides = (): MediaSlide[] => {
    const slides: MediaSlide[] = []

    // Photo: MD02 (Supabase) -> MD01 (Supplier)
    const photo = getMediaUrl('MD02', 'MD01')
    if (photo) {
      slides.push({ ...photo, label: 'Product Photo', type: 'photo' })
    }

    // Drawing: MD64 (Supabase) -> MD12 (Supplier)
    const drawing = getMediaUrl('MD64', 'MD12')
    if (drawing) {
      slides.push({ ...drawing, label: 'Technical Drawing', type: 'drawing' })
    }

    return slides
  }

  const mediaSlides = fullProduct ? buildMediaSlides() : []

  // Get dimensions (EFG00011 features) sorted by ETIM importance (SORTNR)
  const getDimensions = (): Feature[] => {
    if (!fullProduct?.features) return []
    return fullProduct.features
      .filter(f => f.FEATUREGROUPID === 'EFG00011' && hasDisplayableValue(f))
      .sort((a, b) => {
        // Sort by SORTNR (lower = more important), nulls last
        const sortA = a.SORTNR ?? 9999
        const sortB = b.SORTNR ?? 9999
        return sortA - sortB
      })
  }

  const dimensions = fullProduct ? getDimensions() : []

  // Handle image error - trigger fallback
  const handleImageError = (url: string) => {
    setFailedUrls(prev => new Set(prev).add(url))
  }

  const handleGenerate = useCallback(async () => {
    if (!product) return

    setStep('fetching')
    setError(null)
    setGeneratedPngPath(null)
    setJobId(null)  // Reset to allow SymbolProgress to reset its state

    try {
      // Use cached fullProduct if available, otherwise fetch
      let productData = fullProduct
      if (!productData) {
        const productResponse = await fetch(`/api/products/${product.product_id}`)
        if (!productResponse.ok) {
          throw new Error('Failed to fetch product details')
        }
        const { data } = await productResponse.json() as { data: ProductInfo }
        productData = data
        setFullProduct(data)
      }

      if (!productData) {
        throw new Error('Product not found')
      }

      // Step 2: Vision analysis
      setStep('analyzing')
      const analyzeResponse = await fetch('/api/symbol-generator/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: productData }),
      })

      const analysisResult = await analyzeResponse.json()

      if (!analysisResult.success || !analysisResult.description) {
        throw new Error(analysisResult.error || 'Vision analysis failed')
      }

      // Step 3: Generate DWG + PNG
      setStep('generating')
      const dims = extractDimensions(productData)

      const generateResponse = await fetch('/api/symbol-generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: productData,
          spec: analysisResult.description,
          dimensions: dims,
          saveToSupabase: true,
        }),
      })

      const generateResult = await generateResponse.json()

      if (!generateResult.success || !generateResult.jobId) {
        throw new Error('Failed to start generation')
      }

      setJobId(generateResult.jobId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStep('error')
    }
  }, [product, fullProduct])

  // Handle job completion
  const handleJobComplete = useCallback((result: { success: boolean; savedToSupabase?: boolean; pngPath?: string; svgPath?: string }) => {
    if (result.success) {
      if (result.pngPath) {
        setGeneratedPngPath(result.pngPath)
        setSymbolCleared(false)  // Clear the deleted state since we have a new symbol
      }
      if (result.svgPath) {
        setGeneratedSvgPath(result.svgPath)
      }
      setStep('done')
      onSymbolGenerated?.()
    } else {
      setStep('error')
      setError('Generation failed - check logs above')
    }
  }, [onSymbolGenerated])

  // Handle delete with two-step confirmation
  const handleDeleteClick = useCallback(async () => {
    if (!product) return

    if (deleteState === 'idle') {
      // First click: show confirmation
      setDeleteState('confirming')
      // Auto-reset after 3 seconds if not confirmed
      setTimeout(() => {
        setDeleteState(prev => prev === 'confirming' ? 'idle' : prev)
      }, 3000)
    } else if (deleteState === 'confirming') {
      // Second click: execute delete
      setDeleteState('deleting')
      const result = await deleteProductSymbolAction(product.foss_pid)
      if (result.success) {
        setGeneratedPngPath(null)
        setGeneratedSvgPath(null)
        setSymbolCleared(true)  // Show "No symbol generated" immediately
        setStep('idle')
        onSymbolGenerated?.() // Refresh parent data
      } else {
        setError(result.error || 'Failed to delete symbol')
      }
      setDeleteState('idle')
    }
  }, [product, deleteState, onSymbolGenerated])

  if (!product) return null

  const hasExistingSymbol = !!(product.symbol_png_path || product.symbol_svg_path) && !symbolCleared
  const displayPngPath = symbolCleared ? null : (generatedPngPath || product.symbol_png_path)
  const displaySvgPath = symbolCleared ? null : (generatedSvgPath || product.symbol_svg_path)
  const dimensionsConfig = FEATURE_GROUP_CONFIG['EFG00011']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge
              variant={product.symbol ? 'default' : 'outline'}
              className={cn(
                'text-xs font-bold',
                !product.symbol && 'bg-amber-500 text-white border-amber-500'
              )}
            >
              {product.symbol || '?'}
            </Badge>
            <span>{product.foss_pid}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Description */}
          <p className="text-sm text-muted-foreground">
            {product.description_short}
          </p>

          {/* Two-column layout: Media + Dimensions | Symbol */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Product Preview (Photo/Drawing + Dimensions) */}
            <div className="space-y-4">
              {/* Media Carousel */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <ImageIcon className="w-4 h-4" />
                  <span>Product Media</span>
                </div>

                {loadingProduct ? (
                  <div className="aspect-[4/3] rounded-lg border bg-muted/30 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : mediaSlides.length > 0 ? (
                  <div className="relative">
                    <div className="aspect-[4/3] rounded-lg border bg-muted/10 overflow-hidden">
                      <Image
                        src={mediaSlides[currentSlide].url}
                        alt={mediaSlides[currentSlide].label}
                        fill
                        className="object-contain"
                        onError={() => handleImageError(mediaSlides[currentSlide].url)}
                      />
                    </div>

                    {/* Slide label */}
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs">
                      {mediaSlides[currentSlide].label}
                    </div>

                    {/* Navigation */}
                    {mediaSlides.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentSlide(prev => prev === 0 ? mediaSlides.length - 1 : prev - 1)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setCurrentSlide(prev => prev === mediaSlides.length - 1 ? 0 : prev + 1)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>

                        {/* Dots */}
                        <div className="absolute bottom-2 right-2 flex gap-1">
                          {mediaSlides.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentSlide(idx)}
                              className={cn(
                                'w-2 h-2 rounded-full transition-colors',
                                idx === currentSlide ? 'bg-white' : 'bg-white/50'
                              )}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="aspect-[4/3] rounded-lg border-2 border-dashed bg-muted/30 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No media available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Dimensions */}
              <div className="space-y-2">
                <div className={cn('flex items-center gap-2 text-sm font-medium', dimensionsConfig?.color || 'text-muted-foreground')}>
                  <Ruler className="w-4 h-4" />
                  <span>Dimensions</span>
                </div>

                {loadingProduct ? (
                  <div className="h-24 rounded-lg border bg-muted/30 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : dimensions.length > 0 ? (
                  <div className="rounded-lg border bg-muted/10 p-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {dimensions.map((feature, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-muted-foreground truncate mr-2">
                            {feature.feature_name || feature.FEATUREID}
                          </span>
                          <span className="font-medium whitespace-nowrap">
                            {getFeatureDisplayValue(feature)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed bg-muted/30 p-4 text-center">
                    <p className="text-sm text-muted-foreground">No dimensions available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Symbol Preview */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="w-4 h-4" />
                <span>Generated Symbol</span>
              </div>

              <SymbolGallery
                fossPid={product.foss_pid}
                pngPath={displayPngPath}
                svgPath={displaySvgPath}
                deleteState={deleteState}
                onDelete={displayPngPath || displaySvgPath ? handleDeleteClick : undefined}
              />

              {/* Generation Actions */}
              <div className="flex justify-center pt-2">
                {step === 'idle' && (
                  <Button onClick={handleGenerate} size="lg" className="w-full">
                    <Sparkles className="w-4 h-4 mr-2" />
                    {hasExistingSymbol ? 'Regenerate Symbol' : 'Generate Symbol'}
                  </Button>
                )}

                {(step === 'fetching' || step === 'analyzing' || (step === 'generating' && !jobId)) && (
                  <Button disabled size="lg" className="w-full">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {step === 'fetching' && 'Fetching product...'}
                    {step === 'analyzing' && 'Analyzing product...'}
                    {step === 'generating' && 'Starting generation...'}
                  </Button>
                )}

                {step === 'done' && (
                  <Button onClick={handleGenerate} variant="outline" size="lg" className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                )}

                {step === 'error' && (
                  <Button onClick={handleGenerate} variant="outline" size="lg" className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Generation Progress */}
          {jobId && (
            <SymbolProgress
              jobId={jobId}
              onComplete={handleJobComplete}
            />
          )}

          {/* Error Message */}
          {error && step === 'error' && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
