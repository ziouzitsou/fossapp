'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Package,
  Eye,
  Grid3X3,
  Sparkles,
  ChevronRight,
  FolderPlus,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { ProductInfo } from '@/types/product'
import { ProductImage } from '@/components/tiles/product-image'
import { useBucket } from '@/components/tiles/bucket-context'
import { useActiveProject } from '@/lib/active-project-context'
import { addProductToProjectAction } from '@/lib/actions'
import { toast } from 'sonner'

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Helper to get product image URL
function getProductImage(product: ProductInfo): string | undefined {
  return product.multimedia?.find(m => m.mime_code === 'MD02')?.mime_source
    || product.multimedia?.find(m => m.mime_code === 'MD01')?.mime_source
}

// Helper to get deeplink URL
function getProductDeeplink(product: ProductInfo): string | undefined {
  return product.multimedia?.find(m => m.mime_code === 'MD04')?.mime_source
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const router = useRouter()
  const { addToBucket, isInBucket } = useBucket()
  const { activeProject } = useActiveProject()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const [addingToProject, setAddingToProject] = useState<string | null>(null)

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setHasSearched(false)
      setCopiedId(null)
      setExpandedProduct(null)
      setAddingToProject(null)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      setHasSearched(true)

      try {
        const response = await fetch(`/api/tiles/search?q=${encodeURIComponent(query.trim())}`)
        if (response.ok) {
          const { data } = await response.json()
          setResults(data || [])
        } else {
          setResults([])
        }
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleCopyPid = useCallback((product: ProductInfo, e?: React.MouseEvent) => {
    e?.stopPropagation()
    navigator.clipboard.writeText(product.foss_pid)
    setCopiedId(product.product_id)
    toast.success(`Copied ${product.foss_pid}`)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const handleViewProduct = useCallback((product: ProductInfo) => {
    onOpenChange(false)
    router.push(`/products/${product.product_id}`)
  }, [onOpenChange, router])

  const handleAddToTiles = useCallback((product: ProductInfo, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (isInBucket(product.product_id)) {
      toast.info('Already in Tiles bucket')
      return
    }
    addToBucket(product)
    toast.success('Added to Tiles bucket', {
      action: {
        label: 'Open Tiles',
        onClick: () => {
          onOpenChange(false)
          router.push('/tiles')
        }
      }
    })
  }, [addToBucket, isInBucket, onOpenChange, router])

  const handleOpenInSymbolGenerator = useCallback((product: ProductInfo, e?: React.MouseEvent) => {
    e?.stopPropagation()
    onOpenChange(false)
    // Navigate to symbol generator with product ID as query param
    router.push(`/symbol-generator?pid=${product.product_id}`)
  }, [onOpenChange, router])

  const handleOpenDeeplink = useCallback((product: ProductInfo, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const deeplink = getProductDeeplink(product)
    if (deeplink) {
      window.open(deeplink, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const handleAddToProject = useCallback(async (product: ProductInfo, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!activeProject) {
      toast.error('No active project', {
        description: 'Select a project first from the Projects page',
        action: {
          label: 'Go to Projects',
          onClick: () => {
            onOpenChange(false)
            router.push('/projects')
          }
        }
      })
      return
    }

    setAddingToProject(product.product_id)
    try {
      const result = await addProductToProjectAction({
        project_id: activeProject.id,
        product_id: product.product_id,
        quantity: 1,
      })

      if (result.success) {
        toast.success(`Added to ${activeProject.name}`, {
          action: {
            label: 'View Project',
            onClick: () => {
              onOpenChange(false)
              router.push(`/projects/${activeProject.id}`)
            }
          }
        })
      } else {
        toast.error('Failed to add product', {
          description: result.error
        })
      }
    } catch (error) {
      toast.error('Failed to add product')
    } finally {
      setAddingToProject(null)
    }
  }, [activeProject, onOpenChange, router])

  const toggleExpanded = useCallback((productId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setExpandedProduct(prev => prev === productId ? null : productId)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-2xl">
        <DialogTitle className="sr-only">Search products</DialogTitle>

        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search products by foss_pid or name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {isLoading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
          </div>
          <CommandList className="max-h-[500px]">
            {!hasSearched && !isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                Type to search products...
              </div>
            )}

            {hasSearched && !isLoading && results.length === 0 && (
              <CommandEmpty>No products found for &quot;{query}&quot;</CommandEmpty>
            )}

            {results.length > 0 && (
              <CommandGroup heading={`${results.length} product${results.length > 1 ? 's' : ''} found`}>
                {results.map((product) => {
                  const imageUrl = getProductImage(product)
                  const deeplink = getProductDeeplink(product)
                  const isCopied = copiedId === product.product_id
                  const isExpanded = expandedProduct === product.product_id
                  const inBucket = isInBucket(product.product_id)

                  return (
                    <div key={product.product_id}>
                      <CommandItem
                        value={`${product.foss_pid} ${product.description_short}`}
                        onSelect={() => toggleExpanded(product.product_id)}
                        className="flex items-start gap-3 py-3 cursor-pointer"
                      >
                        {/* Thumbnail */}
                        <ProductImage
                          src={imageUrl}
                          alt={product.description_short}
                          size="sm"
                          className="flex-shrink-0 mt-0.5"
                        />

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate text-sm">
                                {product.description_short}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {product.foss_pid}
                              </div>
                            </div>
                            <ChevronRight
                              className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                            />
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <Badge variant="outline" className="text-xs">
                              {product.supplier_name}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {product.class_name}
                            </Badge>
                            {inBucket && (
                              <Badge variant="default" className="text-xs bg-green-600">
                                In Tiles
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CommandItem>

                      {/* Expanded Actions */}
                      {isExpanded && (
                        <div className="ml-[60px] mb-2 flex flex-wrap gap-2 px-2 animate-in slide-in-from-top-2 duration-200">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewProduct(product)
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Details
                          </button>

                          <button
                            onClick={(e) => handleAddToTiles(product, e)}
                            disabled={inBucket}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Grid3X3 className="h-3.5 w-3.5" />
                            {inBucket ? 'In Tiles' : 'Add to Tiles'}
                          </button>

                          <button
                            onClick={(e) => handleOpenInSymbolGenerator(product, e)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Symbol Generator
                          </button>

                          <button
                            onClick={(e) => handleAddToProject(product, e)}
                            disabled={addingToProject === product.product_id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
                          >
                            {addingToProject === product.product_id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FolderPlus className="h-3.5 w-3.5" />
                            )}
                            {activeProject ? `Add to ${activeProject.project_code}` : 'Add to Project'}
                          </button>

                          <button
                            onClick={(e) => handleCopyPid(product, e)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            {isCopied ? 'Copied!' : 'Copy PID'}
                          </button>

                          {deeplink && (
                            <button
                              onClick={(e) => handleOpenDeeplink(product, e)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Supplier Page
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </CommandGroup>
            )}

            {results.length > 0 && (
              <>
                <CommandSeparator />
                <div className="p-2 text-xs text-muted-foreground text-center">
                  Click a product to expand actions • <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd> to close
                </div>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
