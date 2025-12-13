'use client'

import { useState } from 'react'
import { Search, Plus, Check, Loader2, ExternalLink, History, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProductInfo, getProductImage, getProductDeeplink } from '@/lib/tiles/types'
import { ProductImage } from './product-image'
import { useBucket } from '@/components/tiles/bucket-context'
import { useSearchHistory } from '@/lib/user-settings-context'

export function ProductSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const { addToBucket, isInBucket } = useBucket()

  // Use synced search history (syncs to DB for authenticated users)
  const { history: searchHistory, addToHistory, removeFromHistory, clearHistory } = useSearchHistory('tiles')

  const handleSearch = async (searchTerm?: string) => {
    const term = searchTerm ?? query
    if (!term.trim()) return

    setQuery(term)
    setIsLoading(true)
    setError(null)
    setHasSearched(true)
    setShowHistory(false)

    try {
      // Use tiles search API endpoint (rate limited, authenticated)
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
      setResults(data || [])
      addToHistory(term)
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

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by foss_pid (e.g., MY8204045139)"
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

      {/* Results */}
      {hasSearched && !isLoading && results.length === 0 && !error && (
        <div className="text-sm text-muted-foreground text-center py-8">
          No products found for "{query}"
        </div>
      )}

      <div className="space-y-3">
        {results.map((product) => {
          const inBucket = isInBucket(product.product_id)
          const imageUrl = getProductImage(product)
          const deeplink = getProductDeeplink(product)

          return (
            <Card key={product.product_id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Product Image */}
                  <ProductImage
                    src={imageUrl}
                    alt={product.description_short}
                    size="md"
                    className="flex-shrink-0"
                  />

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

                      {/* Add to Bucket Button */}
                      <Button
                        size="sm"
                        variant={inBucket ? 'secondary' : 'default'}
                        onClick={() => addToBucket(product)}
                        disabled={inBucket}
                        className="flex-shrink-0"
                      >
                        {inBucket ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            In Bucket
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
                            Add to Bucket
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
                    {deeplink && (
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
