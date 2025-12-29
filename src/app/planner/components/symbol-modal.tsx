'use client'

/**
 * Symbol Modal Component
 * Modal for viewing/generating product symbol drawings
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
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import type { AreaRevisionProduct } from '@/lib/actions/areas/revision-products-actions'
import { TerminalLog } from '@/components/tiles/terminal-log'
import { extractDimensions } from '@/lib/symbol-generator/dimension-utils'
import type { ProductInfo } from '@fossapp/products/types'

// Supabase storage URL for product-symbols bucket
const SYMBOLS_BUCKET_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-symbols`

interface SymbolModalProps {
  product: AreaRevisionProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSymbolGenerated?: () => void  // Callback when symbol is saved
}

type GenerationStep = 'idle' | 'fetching' | 'analyzing' | 'generating' | 'done' | 'error'

export function SymbolModal({ product, open, onOpenChange, onSymbolGenerated }: SymbolModalProps) {
  const [step, setStep] = useState<GenerationStep>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatedPngPath, setGeneratedPngPath] = useState<string | null>(null)

  // Reset state when modal opens with different product
  useEffect(() => {
    if (open && product) {
      setStep('idle')
      setJobId(null)
      setError(null)
      setGeneratedPngPath(null)
    }
  }, [open, product?.id])

  const handleGenerate = useCallback(async () => {
    if (!product) return

    setStep('fetching')
    setError(null)
    setGeneratedPngPath(null)

    try {
      // Step 1: Fetch full product info
      const productResponse = await fetch(`/api/products/${product.product_id}`)
      if (!productResponse.ok) {
        throw new Error('Failed to fetch product details')
      }
      const { data: fullProduct } = await productResponse.json() as { data: ProductInfo }

      if (!fullProduct) {
        throw new Error('Product not found')
      }

      // Step 2: Vision analysis
      setStep('analyzing')
      const analyzeResponse = await fetch('/api/symbol-generator/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: fullProduct }),
      })

      const analysisResult = await analyzeResponse.json()

      if (!analysisResult.success || !analysisResult.description) {
        throw new Error(analysisResult.error || 'Vision analysis failed')
      }

      // Step 3: Generate DWG + PNG
      setStep('generating')
      const dimensions = extractDimensions(fullProduct)

      const generateResponse = await fetch('/api/symbol-generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: fullProduct,
          spec: analysisResult.description,
          dimensions,
          saveToSupabase: true,  // Save to Supabase bucket
        }),
      })

      const generateResult = await generateResponse.json()

      if (!generateResult.success || !generateResult.jobId) {
        throw new Error('Failed to start generation')
      }

      setJobId(generateResult.jobId)
      // TerminalLog will handle polling and completion

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStep('error')
    }
  }, [product])

  // Handle job completion (called from TerminalLog)
  const handleJobComplete = useCallback((result: { success: boolean; savedToSupabase?: boolean; pngPath?: string }) => {
    if (result.success) {
      if (result.pngPath) {
        setGeneratedPngPath(result.pngPath)
      }
      setStep('done')
      onSymbolGenerated?.()
    } else {
      setStep('error')
      setError('Generation failed - check logs above')
    }
  }, [onSymbolGenerated])

  if (!product) return null

  const hasExistingSymbol = !!product.symbol_svg_path
  const displayPngPath = generatedPngPath || product.symbol_svg_path

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
          {/* Product Info */}
          <p className="text-sm text-muted-foreground">
            {product.description_short}
          </p>

          {/* Symbol Preview */}
          <div className="aspect-square w-full max-w-[250px] mx-auto rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/30">
            {displayPngPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${SYMBOLS_BUCKET_URL}/${displayPngPath}?t=${Date.now()}`}
                alt={`Symbol for ${product.foss_pid}`}
                className="w-full h-full object-contain p-4"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Sparkles className="w-12 h-12" />
                <p className="text-sm">No symbol generated</p>
              </div>
            )}
          </div>

          {/* Generation Progress / Logs */}
          {jobId && (
            <div className="border rounded-lg overflow-hidden">
              <TerminalLog
                jobId={jobId}
                onComplete={handleJobComplete}
              />
            </div>
          )}

          {/* Error Message */}
          {error && step === 'error' && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-2">
            {step === 'idle' && (
              <Button onClick={handleGenerate} size="lg">
                <Sparkles className="w-4 h-4 mr-2" />
                {hasExistingSymbol ? 'Regenerate Symbol' : 'Generate Symbol'}
              </Button>
            )}

            {(step === 'fetching' || step === 'analyzing' || (step === 'generating' && !jobId)) && (
              <Button disabled size="lg">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {step === 'fetching' && 'Fetching product...'}
                {step === 'analyzing' && 'Analyzing product...'}
                {step === 'generating' && 'Starting generation...'}
              </Button>
            )}

            {step === 'done' && (
              <Button onClick={handleGenerate} variant="outline" size="lg">
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
            )}

            {step === 'error' && (
              <Button onClick={handleGenerate} variant="outline" size="lg">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
