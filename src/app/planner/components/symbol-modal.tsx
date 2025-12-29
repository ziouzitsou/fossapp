'use client'

/**
 * Symbol Modal Component
 * Modal for viewing/generating product symbol drawings
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { cn } from '@fossapp/ui'
import { Sparkles } from 'lucide-react'
import type { AreaRevisionProduct } from '@/lib/actions/areas/revision-products-actions'

// Supabase storage URL for product-symbols bucket
const SYMBOLS_BUCKET_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-symbols`

interface SymbolModalProps {
  product: AreaRevisionProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SymbolModal({ product, open, onOpenChange }: SymbolModalProps) {
  if (!product) return null

  const hasSymbol = !!product.symbol_svg_path

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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

          {/* Symbol Preview / Generate Area */}
          <div className="aspect-square w-full max-w-[300px] mx-auto rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/30">
            {hasSymbol ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${SYMBOLS_BUCKET_URL}/${product.symbol_svg_path}`}
                alt={`Symbol for ${product.foss_pid}`}
                className="w-full h-full object-contain p-4"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Sparkles className="w-12 h-12" />
                <div className="text-center">
                  <p className="font-medium">No symbol generated</p>
                  <p className="text-sm">Symbol generation coming soon</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions placeholder */}
          <div className="text-center text-sm text-muted-foreground">
            {hasSymbol
              ? 'Symbol generation and editing will be available here.'
              : 'Click "Generate" to create a symbol drawing for this product.'}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
