'use client'

import { useState, ReactNode } from 'react'
import { Search, Loader2, ExternalLink, History, X } from 'lucide-react'
import { Input } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Card, CardContent } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { ProductInfo } from '@fossapp/products/types'
import { ProductImage } from '@/components/tiles/product-image'
import { useSearchHistory } from '@/lib/user-settings-context'

// Helper functions for multimedia URLs
function getProductImage(product: ProductInfo): string | undefined {
  return product.multimedia?.find(m => m.mime_code === 'MD02')?.mime_source
    || product.multimedia?.find(m => m.mime_code === 'MD01')?.mime_source
}

function getProductDeeplink(product: ProductInfo): string | undefined {
  return product.multimedia?.find(m => m.mime_code === 'MD04')?.mime_source
}

/** Supported search history keys - must match useSearchHistory types */
export type SearchHistoryKey = 'tiles' | 'symbols' | 'customers'

export interface ProductSearchProps {
  /** Callback when user performs action on a product */
  onProductAction: (product: ProductInfo) => void
  /** Label for the action button (default: "Select") */
  actionLabel?: string
  /** Icon to show before action label */
  actionIcon?: ReactNode
  /** Check if action should be disabled for a product */
  isActionDisabled?: (product: ProductInfo) => boolean
  /** Label to show when action is disabled/completed */
  actionCompletedLabel?: string
  /** Icon to show when action is completed */
  actionCompletedIcon?: ReactNode
  /** Key for search history storage */
  historyKey: SearchHistoryKey
  /** Whether to show product images in results (default: true) */
  showImages?: boolean
  /** Whether to show deeplinks in results (default: true) */
  showDeeplinks?: boolean
  /** Placeholder text for search input */
  placeholder?: string
  /** Called after search completes with results */
  onSearchComplete?: (results: ProductInfo[]) => void
  /** Clear results after action is performed (default: false) */
  clearOnAction?: boolean
}

export function ProductSearch({
  onProductAction,
  actionLabel = 'Select',
  actionIcon,
  isActionDisabled,
  actionCompletedLabel,
  actionCompletedIcon,
  historyKey,
  showImages = true,
  showDeeplinks = true,
  placeholder = 'Search by foss_pid or product name...',
  onSearchComplete,
  clearOnAction = false,
}: ProductSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Use synced search history
  const { history: searchHistory, addToHistory, removeFromHistory, clearHistory } = useSearchHistory(historyKey)

  const handleSearch = async (searchTerm?: string) => {
    const term = searchTerm ?? query
    if (!term.trim()) return

    setQuery(term)
    setIsLoading(true)
    setError(null)
    setHasSearched(true)
    setShowHistory(false)

    try {
      const response = await fetch(`/api/tiles/search?q=${encodeURIComponent(term.trim())}`)

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to search products')
        }
        if (response.status === 429) {
          throw new Error('Too many requests. Please slow down.')
        }
        throw new Error('Search failed')
      }

      const { data } = await response.json()
      const searchResults = data || []
      setResults(searchResults)
      addToHistory(term)
      onSearchComplete?.(searchResults)
    } catch (err) {
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : 'Failed to search products. Please try again.')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleAction = (product: ProductInfo) => {
    onProductAction(product)
    if (clearOnAction) {
      setResults([])
      setHasSearched(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => handleSearch()} disabled={isLoading || !query.trim()}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Search'
          )}
        </Button>
      </div>

      {/* Search History Dropdown */}
      {showHistory && searchHistory.length > 0 && (
        <div className="bg-card border rounded-md shadow-lg p-2">
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <History className="h-3 w-3" />
              Recent searches
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={clearHistory}
            >
              Clear all
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((term) => (
              <div
                key={term}
                className="group flex items-center gap-1 bg-muted hover:bg-accent rounded-full px-3 py-1 cursor-pointer"
                onClick={() => handleSearch(term)}
              >
                <span className="text-sm">{term}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFromHistory(term)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {error}
        </div>
      )}

      {/* No Results */}
      {hasSearched && !isLoading && results.length === 0 && !error && (
        <div className="text-sm text-muted-foreground text-center py-8">
          No products found for &quot;{query}&quot;
        </div>
      )}

      {/* Results */}
      <div className="space-y-3">
        {results.map((product) => {
          const disabled = isActionDisabled?.(product) ?? false
          const imageUrl = getProductImage(product)
          const deeplink = getProductDeeplink(product)

          return (
            <Card key={product.product_id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Product Image */}
                  {showImages && (
                    <ProductImage
                      src={imageUrl}
                      alt={product.description_short}
                      size="md"
                      className="flex-shrink-0"
                    />
                  )}

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-medium truncate">
                          {product.description_short}
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono">
                          {product.foss_pid}
                        </p>
                      </div>

                      {/* Action Button */}
                      <Button
                        size="sm"
                        variant={disabled ? 'secondary' : 'default'}
                        onClick={() => handleAction(product)}
                        disabled={disabled}
                        className="flex-shrink-0"
                      >
                        {disabled ? (
                          <>
                            {actionCompletedIcon}
                            {actionCompletedLabel || actionLabel}
                          </>
                        ) : (
                          <>
                            {actionIcon}
                            {actionLabel}
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {product.supplier_name}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {product.class_name}
                      </Badge>
                      {product.family && (
                        <Badge variant="secondary" className="text-xs">
                          {product.family}
                        </Badge>
                      )}
                    </div>

                    {/* Deeplink */}
                    {showDeeplinks && deeplink && (
                      <a
                        href={deeplink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Product page
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/** Clear search results programmatically - export for external control */
export type ProductSearchRef = {
  clearResults: () => void
  setQuery: (query: string) => void
}
