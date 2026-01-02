/**
 * Generate Symbol Button - Multi-phase generation trigger with inline progress
 *
 * A stateful button that visually transforms through each generation phase,
 * providing real-time feedback without a separate progress indicator.
 *
 * @remarks
 * **Generation Phases (in order)**:
 * 1. `idle` → "Generate Symbol" / "Regenerate Symbol"
 * 2. `fetching` → Loading full product data if needed
 * 3. `analyzing` → Vision AI analyzing product images
 * 4. `generating:llm` → LLM creating AutoLISP script
 * 5. `generating:aps` → AutoCAD executing script via APS
 * 6. `generating:storage` → Saving PNG/SVG to Supabase
 * 7. `success` → Shows cost + duration (click to dismiss)
 * 8. `error` → Shows error message (click to dismiss)
 *
 * **Cost Tracking**: Aggregates costs from both vision analysis and LLM phases.
 *
 * @see {@link SymbolModal} which hosts this button
 */
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@fossapp/ui'
import { cn } from '@fossapp/ui'
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
  AlertCircle,
  Eye,
  Cpu,
  Database,
  Pencil,
} from 'lucide-react'
import type { ProductInfo } from '@fossapp/products/types'
import type { LogMessage } from '@/components/tiles/terminal-log'
import { extractDimensions } from '@/lib/symbol-generator/dimension-utils'

/** Current generation phase - determines button appearance and label. */
type Phase =
  | 'idle'
  | 'fetching'
  | 'analyzing'
  | 'generating:llm'      // Generating AutoLISP
  | 'generating:aps'      // Running AutoCAD
  | 'generating:storage'  // Saving symbol
  | 'success'
  | 'error'

/**
 * Props for the GenerateSymbolButton component.
 */
interface GenerateSymbolButtonProps {
  /** Minimal product info needed for generation */
  product: {
    id: string
    product_id: string
    foss_pid: string
    symbol?: string | null
    symbol_png_path?: string | null
    symbol_svg_path?: string | null
  }
  /** Full product data if already loaded (avoids refetch) */
  fullProduct: ProductInfo | null
  /** Async function to fetch full product data when needed */
  onFetchProduct: () => Promise<ProductInfo | null>
  /** Called after successful generation with output paths */
  onSuccess: (result: {
    pngPath?: string
    svgPath?: string
    savedToSupabase?: boolean
  }) => void
  /** Whether product already has a generated symbol (changes button text) */
  hasExistingSymbol: boolean
  /** Additional CSS classes */
  className?: string
}

/** Configuration for each generation phase (label and icon). */
const PHASE_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  idle: { label: 'Generate Symbol', icon: Sparkles },
  fetching: { label: 'Fetching...', icon: Loader2 },
  analyzing: { label: 'Analyzing...', icon: Eye },
  'generating:llm': { label: 'Generating AutoLISP...', icon: Pencil },
  'generating:aps': { label: 'Running AutoCAD...', icon: Cpu },
  'generating:storage': { label: 'Saving symbol...', icon: Database },
  success: { label: 'Done', icon: Check },
  error: { label: 'Failed', icon: AlertCircle },
}

export function GenerateSymbolButton({
  product,
  fullProduct,
  onFetchProduct,
  onSuccess,
  hasExistingSymbol,
  className,
}: GenerateSymbolButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{ cost: number; duration: number } | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  // Track costs from both phases
  const analyzeCostRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const completedRef = useRef<boolean>(false)

  // Reset when product changes
  useEffect(() => {
    setPhase('idle')
    setError(null)
    setSuccessInfo(null)
    setJobId(null)
    analyzeCostRef.current = 0
    startTimeRef.current = 0
    completedRef.current = false
  }, [product.id])

  // SSE subscription for generation progress
  useEffect(() => {
    if (!jobId) return

    const eventSource = new EventSource(`/api/tiles/stream/${jobId}`)

    eventSource.onmessage = (event) => {
      try {
        const msg: LogMessage = JSON.parse(event.data)

        // Guard: If already completed, ignore all messages (SSE reconnection replays all messages)
        if (completedRef.current) {
          eventSource.close()
          return
        }

        // Update phase based on SSE messages
        if (msg.phase === 'llm') {
          setPhase('generating:llm')
        } else if (msg.phase === 'aps') {
          setPhase('generating:aps')
        } else if (msg.phase === 'storage') {
          setPhase('generating:storage')
        } else if (msg.phase === 'complete' && msg.result) {
          completedRef.current = true

          const duration = (Date.now() - startTimeRef.current) / 1000
          const totalCost = (analyzeCostRef.current || 0) + (msg.result.costEur || 0)

          setPhase('success')
          setSuccessInfo({ cost: totalCost, duration })

          onSuccess({
            pngPath: msg.result.pngPath,
            svgPath: msg.result.svgPath,
            savedToSupabase: msg.result.savedToSupabase,
          })
          eventSource.close()
        } else if (msg.phase === 'error') {
          setPhase('error')
          setError(msg.message || 'Generation failed')
          eventSource.close()
        }
      } catch {
        // Ignore parse errors
      }
    }

    eventSource.addEventListener('done', () => {
      eventSource.close()
    })

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [jobId, onSuccess])

  const handleClick = useCallback(async () => {
    // If in success or error state, clicking resets to idle
    if (phase === 'success' || phase === 'error') {
      setPhase('idle')
      setError(null)
      setSuccessInfo(null)
      setJobId(null)
      return
    }

    // Don't allow clicking during active generation
    if (phase !== 'idle') return

    // Start generation
    startTimeRef.current = Date.now()
    analyzeCostRef.current = 0
    completedRef.current = false
    setError(null)
    setSuccessInfo(null)

    try {
      // Phase 1: Fetch product if needed
      setPhase('fetching')
      let productData = fullProduct
      if (!productData) {
        productData = await onFetchProduct()
        if (!productData) {
          throw new Error('Failed to fetch product details')
        }
      }

      // Phase 2: Vision analysis
      setPhase('analyzing')
      const analyzeResponse = await fetch('/api/symbol-generator/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: productData }),
      })

      const analysisResult = await analyzeResponse.json()

      if (!analysisResult.success || !analysisResult.description) {
        throw new Error(analysisResult.error || 'Vision analysis failed')
      }

      // Capture analyze cost (convert USD to EUR roughly, actual conversion in generate)
      analyzeCostRef.current = analysisResult.costUsd * 0.92 // Approximate EUR

      // Phase 3: Start generation (sets jobId, SSE takes over)
      setPhase('generating:llm')
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
      setPhase('error')
    }
  }, [phase, fullProduct, onFetchProduct])

  // Determine button appearance based on phase
  const isLoading = phase !== 'idle' && phase !== 'success' && phase !== 'error'
  const isSuccess = phase === 'success'
  const isError = phase === 'error'

  // Get current phase config
  const config = PHASE_CONFIG[phase] || PHASE_CONFIG.idle
  const Icon = config.icon

  // Build label
  let label = config.label
  if (phase === 'idle' && hasExistingSymbol) {
    label = 'Regenerate Symbol'
  } else if (isSuccess && successInfo) {
    label = `€${successInfo.cost.toFixed(4)} · ${successInfo.duration.toFixed(1)}s`
  } else if (isError && error) {
    // Truncate long errors
    label = error.length > 40 ? error.slice(0, 37) + '...' : error
  }

  return (
    <Button
      onClick={handleClick}
      size="lg"
      disabled={isLoading}
      variant={isError ? 'destructive' : isSuccess ? 'outline' : 'default'}
      className={cn(
        'w-full transition-all duration-200',
        isSuccess && 'bg-emerald-500/10 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400',
        isError && 'cursor-pointer', // Allow click to dismiss
        className
      )}
    >
      <Icon className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
      {label}
      {(isSuccess || isError) && (
        <span className="ml-2 text-xs opacity-60">(click to dismiss)</span>
      )}
    </Button>
  )
}
