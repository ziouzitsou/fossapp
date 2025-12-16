'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Loader2,
  Sparkles,
  Copy,
  Check,
  ImageIcon,
  FileImage,
  AlertCircle,
  RefreshCw,
  FileBox,
  Download,
  Eye,
  MousePointerClick,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ProductInfo } from '@/types/product'
import {
  extractDimensions,
  formatDimensionsForDisplay,
} from '@/lib/symbol-generator/dimension-utils'
import { VisionAnalysisResult, LuminaireDimensions } from '@/lib/symbol-generator/types'
import { TerminalLog } from '@/components/tiles/terminal-log'
import { SymbolViewerModal } from './symbol-viewer-modal'
import { ProductSearch } from '@/components/shared/product-search'

// DWG generation result type
interface DwgGenerationResult {
  success: boolean
  viewerUrn?: string
  hasDwgBuffer?: boolean
  hasPngBuffer?: boolean
  costEur?: number
  llmModel?: string
  tokensIn?: number
  tokensOut?: number
}

interface SymbolGeneratorFormProps {
  /** Initial product ID to auto-load (from URL param) */
  initialProductId?: string
}

export function SymbolGeneratorForm({ initialProductId }: SymbolGeneratorFormProps) {
  // Track if search should be shown
  const [showSearch, setShowSearch] = useState(!initialProductId)
  const [isLoadingInitial, setIsLoadingInitial] = useState(!!initialProductId)

  // Selected product state
  const [selectedProduct, setSelectedProduct] = useState<ProductInfo | null>(null)
  const [dimensions, setDimensions] = useState<LuminaireDimensions | null>(null)

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<VisionAnalysisResult | null>(null)
  const [copied, setCopied] = useState(false)

  // DWG generation state
  const [dwgJobId, setDwgJobId] = useState<string | null>(null)
  const [isGeneratingDwg, setIsGeneratingDwg] = useState(false)
  const [dwgResult, setDwgResult] = useState<DwgGenerationResult | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  // Handle product selection
  const handleSelectProduct = useCallback((product: ProductInfo) => {
    setSelectedProduct(product)
    setDimensions(extractDimensions(product))
    setShowSearch(false) // Hide search after selection
    setAnalysisResult(null)
    // Clear DWG state
    setDwgJobId(null)
    setIsGeneratingDwg(false)
    setDwgResult(null)
  }, [])

  // Auto-load product from initialProductId
  useEffect(() => {
    if (!initialProductId) return

    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${initialProductId}`)
        if (response.ok) {
          const { data } = await response.json()
          if (data) {
            handleSelectProduct(data)
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial product:', error)
      } finally {
        setIsLoadingInitial(false)
      }
    }

    fetchProduct()
  }, [initialProductId, handleSelectProduct])

  // Handle analysis
  const handleAnalyze = useCallback(async () => {
    if (!selectedProduct) return

    setIsAnalyzing(true)
    setAnalysisResult(null)

    try {
      const response = await fetch('/api/symbol-generator/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: selectedProduct }),
      })

      const result: VisionAnalysisResult = await response.json()
      setAnalysisResult(result)
    } catch (error) {
      setAnalysisResult({
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
        model: '',
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        processingTimeMs: 0,
        hadImage: false,
        hadDrawing: false,
        dimensionsProvided: [],
      })
    } finally {
      setIsAnalyzing(false)
    }
  }, [selectedProduct])

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!analysisResult?.description) return

    try {
      await navigator.clipboard.writeText(analysisResult.description)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error('Failed to copy')
    }
  }, [analysisResult])

  // Handle DWG generation
  const handleGenerateDwg = useCallback(async () => {
    if (!selectedProduct || !analysisResult?.description || !dimensions) return

    setIsGeneratingDwg(true)
    setDwgResult(null)
    setDwgJobId(null)

    try {
      const response = await fetch('/api/symbol-generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: selectedProduct,
          spec: analysisResult.description,
          dimensions,
        }),
      })

      const data = await response.json()

      if (data.success && data.jobId) {
        setDwgJobId(data.jobId)
      } else {
        setIsGeneratingDwg(false)
        setDwgResult({ success: false })
      }
    } catch {
      setIsGeneratingDwg(false)
      setDwgResult({ success: false })
    }
  }, [selectedProduct, analysisResult, dimensions])

  // Handle DWG generation completion
  const handleDwgComplete = useCallback((result: {
    success: boolean
    viewerUrn?: string
    hasDwgBuffer?: boolean
    hasPngBuffer?: boolean
    costEur?: number
    llmModel?: string
    tokensIn?: number
    tokensOut?: number
  }) => {
    setIsGeneratingDwg(false)
    setDwgResult({
      ...result,
      // PNG is currently not generated (PNGOUT doesn't work in headless mode)
      hasPngBuffer: result.hasPngBuffer ?? false,
    })
  }, [])

  // Handle DWG/PNG download
  const handleDownload = useCallback(async (type: 'dwg' | 'png') => {
    if (!dwgJobId) return

    try {
      const response = await fetch(`/api/symbol-generator/download/${dwgJobId}?type=${type}`)
      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedProduct?.foss_pid || 'Symbol'}_Symbol.${type}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(`Failed to download ${type}:`, error)
    }
  }, [dwgJobId, selectedProduct])

  // Clear selection
  const handleClear = useCallback(() => {
    setSelectedProduct(null)
    setDimensions(null)
    setAnalysisResult(null)
    setShowSearch(true) // Show search again
    // Clear DWG state
    setDwgJobId(null)
    setIsGeneratingDwg(false)
    setDwgResult(null)
  }, [])

  // Get image URLs - prioritize generated Supabase Storage URLs over supplier URLs
  const imageUrl = selectedProduct?.multimedia?.find(
    (m) => m.mime_code === 'MD02'
  )?.mime_source || selectedProduct?.multimedia?.find(
    (m) => m.mime_code === 'MD01'
  )?.mime_source
  const drawingUrl = selectedProduct?.multimedia?.find(
    (m) => m.mime_code === 'MD64'
  )?.mime_source || selectedProduct?.multimedia?.find(
    (m) => m.mime_code === 'MD12'
  )?.mime_source

  const dimensionDisplay = dimensions
    ? formatDimensionsForDisplay(dimensions)
    : null

  // Show loading state while fetching initial product
  if (isLoadingInitial) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading product...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search Section */}
      {showSearch && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Product Search</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductSearch
              onProductAction={handleSelectProduct}
              actionLabel="Select"
              actionIcon={<MousePointerClick className="h-4 w-4 mr-1" />}
              historyKey="symbols"
              placeholder="Enter FOSS PID or product name..."
              showImages={false}
              showDeeplinks={false}
            />
          </CardContent>
        </Card>
      )}

      {/* Selected Product Preview */}
      {selectedProduct && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Product Info & Images */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">Product Preview</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Product Info */}
              <div className="mb-4">
                <h3 className="font-semibold">{selectedProduct.description_short}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge>{selectedProduct.foss_pid}</Badge>
                  <Badge variant="secondary">{selectedProduct.class_name}</Badge>
                  <Badge variant="outline">{selectedProduct.supplier_name}</Badge>
                </div>
              </div>

              {/* Images */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> Photo
                  </p>
                  {imageUrl ? (
                    <div className="aspect-square border rounded-lg overflow-hidden bg-muted">
                      <img
                        src={`/api/image?url=${encodeURIComponent(imageUrl)}&w=256`}
                        alt="Product"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="aspect-square border rounded-lg bg-muted flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileImage className="h-3 w-3" /> Drawing
                  </p>
                  {drawingUrl ? (
                    <div className="aspect-square border rounded-lg overflow-hidden bg-muted">
                      <img
                        src={`/api/image?url=${encodeURIComponent(drawingUrl)}&w=256`}
                        alt="Drawing"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="aspect-square border rounded-lg bg-muted flex items-center justify-center">
                      <FileImage className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dimensions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">ETIM Dimensions</CardTitle>
            </CardHeader>
            <CardContent>
              {dimensionDisplay ? (
                <div className="space-y-4">
                  {/* Outer Dimensions */}
                  {dimensionDisplay.outer.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Outer Dimensions
                      </p>
                      <div className="space-y-1">
                        {dimensionDisplay.outer.map((d, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{d.label}</span>
                            <span className="font-mono">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cutout Dimensions */}
                  {dimensionDisplay.cutout.length > 0 && (
                    <div>
                      <Separator className="my-3" />
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Cutout/Recess
                      </p>
                      <div className="space-y-1">
                        {dimensionDisplay.cutout.map((d, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{d.label}</span>
                            <span className="font-mono">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Characteristics */}
                  {dimensionDisplay.characteristics.length > 0 && (
                    <div>
                      <Separator className="my-3" />
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Characteristics
                      </p>
                      <div className="space-y-1">
                        {dimensionDisplay.characteristics.map((d, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{d.label}</span>
                            <span>{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No dimension data available from ETIM features.
                </p>
              )}

              {/* Analyze Button */}
              <div className="mt-6">
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full"
                  size="lg"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Symbol'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analysis Result */}
      {analysisResult && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                Symbol Description
                {analysisResult.success ? (
                  <Badge variant="default" className="bg-green-600">Success</Badge>
                ) : (
                  <Badge variant="destructive">Error</Badge>
                )}
              </CardTitle>
              {analysisResult.success && analysisResult.description && (
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {analysisResult.error ? (
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p>{analysisResult.error}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Metadata */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Model: {analysisResult.model}</span>
                  <span>
                    Tokens: {analysisResult.tokensIn} / {analysisResult.tokensOut}
                  </span>
                  <span>Cost: ${analysisResult.costUsd.toFixed(4)}</span>
                  <span>Time: {(analysisResult.processingTimeMs / 1000).toFixed(1)}s</span>
                  <span>
                    Images: {analysisResult.hadImage ? 'Photo' : ''}{' '}
                    {analysisResult.hadImage && analysisResult.hadDrawing ? '+' : ''}{' '}
                    {analysisResult.hadDrawing ? 'Drawing' : ''}
                    {!analysisResult.hadImage && !analysisResult.hadDrawing ? 'None' : ''}
                  </span>
                </div>

                <Separator />

                {/* Description Output */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-auto max-h-[500px]">
                    {analysisResult.description}
                  </pre>
                </div>

                {/* Generate DWG Button */}
                {!dwgJobId && !dwgResult && (
                  <div className="pt-4 border-t">
                    <Button
                      onClick={handleGenerateDwg}
                      disabled={isGeneratingDwg}
                      size="lg"
                      className="w-full"
                    >
                      {isGeneratingDwg ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <FileBox className="h-4 w-4 mr-2" />
                      )}
                      {isGeneratingDwg ? 'Generating...' : 'Generate DWG Symbol'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* DWG Generation Progress */}
      {dwgJobId && (
        <TerminalLog
          jobId={dwgJobId}
          onComplete={handleDwgComplete}
          onClose={() => setDwgJobId(null)}
        />
      )}

      {/* DWG Generation Result */}
      {dwgResult && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileBox className="h-5 w-5" />
                Generated Symbol
                {dwgResult.success ? (
                  <Badge variant="default" className="bg-green-600">Success</Badge>
                ) : (
                  <Badge variant="destructive">Failed</Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {dwgResult.success ? (
              <div className="space-y-4">
                {/* Generation metadata */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {dwgResult.llmModel && <span>Model: {dwgResult.llmModel}</span>}
                  {dwgResult.tokensIn && dwgResult.tokensOut && (
                    <span>Tokens: {dwgResult.tokensIn} / {dwgResult.tokensOut}</span>
                  )}
                  {dwgResult.costEur !== undefined && (
                    <span>Cost: €{dwgResult.costEur.toFixed(4)}</span>
                  )}
                </div>

                <Separator />

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  {/* View button */}
                  {(dwgResult.viewerUrn || dwgResult.hasDwgBuffer) && (
                    <Button onClick={() => setViewerOpen(true)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Symbol
                    </Button>
                  )}

                  {/* Download DWG */}
                  {dwgResult.hasDwgBuffer && (
                    <Button variant="outline" onClick={() => handleDownload('dwg')}>
                      <Download className="h-4 w-4 mr-2" />
                      Download DWG
                    </Button>
                  )}

                  {/* Download PNG */}
                  {dwgResult.hasPngBuffer && (
                    <Button variant="outline" onClick={() => handleDownload('png')}>
                      <Download className="h-4 w-4 mr-2" />
                      Download PNG
                    </Button>
                  )}
                </div>

                {/* Regenerate option */}
                <div className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDwgResult(null)
                      setDwgJobId(null)
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Generate again
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p>Symbol generation failed. Please try again or adjust the description.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDwgResult(null)
                    setDwgJobId(null)
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Symbol Viewer Modal */}
      <SymbolViewerModal
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        viewerUrn={dwgResult?.viewerUrn}
        jobId={dwgJobId || undefined}
        fossPid={selectedProduct?.foss_pid}
        hasPng={dwgResult?.hasPngBuffer}
      />
    </div>
  )
}
