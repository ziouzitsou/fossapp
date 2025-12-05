'use client'

import { useState, useCallback, useEffect } from 'react'
import { Search, Plus, Check, Loader2, ExternalLink, History, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { ProductInfo, getProductImage, getProductDeeplink } from '@/lib/tiles/types'
import { ProductImage } from './product-image'
import { useBucket } from '@/components/tiles/bucket-context'

const SEARCH_HISTORY_KEY = 'tiles-search-history'
const MAX_HISTORY_ITEMS = 10

function loadSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveSearchHistory(history: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)))
  } catch (e) {
    console.error('Failed to save search history:', e)
  }
}

export function ProductSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const { addToBucket, isInBucket } = useBucket()

  // Load search history on mount
  useEffect(() => {
    setSearchHistory(loadSearchHistory())
  }, [])

  const addToHistory = useCallback((term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return

    setSearchHistory(prev => {
      // Remove if already exists, then add to front
      const filtered = prev.filter(h => h.toLowerCase() !== trimmed.toLowerCase())
      const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY_ITEMS)
      saveSearchHistory(updated)
      return updated
    })
  }, [])

  const removeFromHistory = useCallback((term: string) => {
    setSearchHistory(prev => {
      const updated = prev.filter(h => h !== term)
      saveSearchHistory(updated)
      return updated
    })
  }, [])

  const clearHistory = useCallback(() => {
    setSearchHistory([])
    saveSearchHistory([])
  }, [])

  const handleSearch = useCallback(async (searchTerm?: string) => {
    const term = searchTerm ?? query
    if (!term.trim()) return

    setQuery(term)
    setIsLoading(true)
    setError(null)
    setHasSearched(true)
    setShowHistory(false)

    try {
      // Use FOSSAPP supabase client with items schema
      const { data, error: searchError } = await supabase
        .schema('items')
        .from('product_info')
        .select('*')
        .ilike('foss_pid', `%${term.trim()}%`)
        .limit(10)

      if (searchError) throw searchError

      setResults(data || [])
      addToHistory(term)
    } catch (err) {
      console.error('Search error:', err)
      setError('Failed to search products. Please try again.')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [query, addToHistory])

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
