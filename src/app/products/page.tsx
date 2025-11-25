'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDevSession } from '@/lib/use-dev-session'
import { type TaxonomyCategory } from '@/lib/real-taxonomy-data'
import {
  getProductsByTaxonomyPaginatedAction,
  getTaxonomyWithCountsAction,
  type ProductByTaxonomy,
  type ProductByTaxonomyResult
} from '@/lib/actions'
import { searchProductsAction, countProductsAction } from '@/lib/search-actions'
import { CategoryLevel1 } from '@/components/products/CategoryLevel1'
import { InfoTooltip } from '@/components/products/InfoTooltip'
import { FilterPanel, type FilterValues } from '@/components/filters/FilterPanel'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'
import { ChevronRight } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { cn } from '@/lib/utils'

function ProductsPageContent() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get URL state
  const [level1, setLevel1] = useState<string | null>(searchParams.get('level1'))
  const [level2, setLevel2] = useState<string | null>(searchParams.get('level2'))
  const [level3, setLevel3] = useState<string | null>(searchParams.get('level3'))

  // Initialize filter values from URL
  const [filterValues, setFilterValues] = useState<FilterValues>(() => {
    const filters: FilterValues = {}

    // Parse supplier
    const supplier = searchParams.get('supplier')
    if (supplier) filters.supplier = Number(supplier)

    // Parse other filters from URL (e.g., cri, voltage, etc.)
    searchParams.forEach((value, key) => {
      if (!['level1', 'level2', 'level3', 'supplier'].includes(key)) {
        try {
          filters[key] = JSON.parse(value)
        } catch {
          filters[key] = value
        }
      }
    })

    return filters
  })

  // Taxonomy state - fetched from database
  const [taxonomy, setTaxonomy] = useState<TaxonomyCategory[]>([])
  const [taxonomyLoading, setTaxonomyLoading] = useState(true)

  // Products state with pagination
  const [productResult, setProductResult] = useState<ProductByTaxonomyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (level1) params.set('level1', level1)
    if (level2) params.set('level2', level2)
    if (level3) params.set('level3', level3)

    // Add all filter values to URL
    Object.entries(filterValues).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object') {
          params.set(key, JSON.stringify(value))
        } else {
          params.set(key, value.toString())
        }
      }
    })

    router.replace(`/products?${params.toString()}`, { scroll: false })
  }, [level1, level2, level3, filterValues, router])

  // Fetch taxonomy data on mount
  useEffect(() => {
    async function fetchTaxonomy() {
      setTaxonomyLoading(true)
      try {
        const data = await getTaxonomyWithCountsAction()
        setTaxonomy(data)
      } catch (error) {
        console.error('Error fetching taxonomy:', error)
      } finally {
        setTaxonomyLoading(false)
      }
    }
    fetchTaxonomy()
  }, [])

  // Reset page when taxonomy or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [level1, level2, level3, filterValues])

  // Check if any dynamic filters (non-supplier) are active
  const hasDynamicFilters = Object.keys(filterValues).some(
    key => key !== 'supplier' && filterValues[key] !== undefined && filterValues[key] !== null
  )

  // Fetch products when taxonomy, filters, or page changes
  useEffect(() => {
    async function fetchProducts() {
      const currentCategory = level3 || level2 || level1
      if (!currentCategory) {
        setProductResult(null)
        return
      }

      setLoading(true)
      try {
        // Use searchProductsAction when dynamic filters are active
        if (hasDynamicFilters) {
          // First get the count
          const total = await countProductsAction({
            categories: [currentCategory],
            suppliers: filterValues.supplier ? [filterValues.supplier.toString()] : undefined,
            indoor: filterValues.indoor ?? null,
            outdoor: filterValues.outdoor ?? null,
            submersible: filterValues.submersible ?? null,
            trimless: filterValues.trimless ?? null,
            cutShapeRound: filterValues.cut_shape_round ?? null,
            cutShapeRectangular: filterValues.cut_shape_rectangular ?? null,
            filters: {
              // Range filters (cct, cri, lumens_output, voltage, beam_angle)
              ...(filterValues.cct?.min !== undefined || filterValues.cct?.max !== undefined ? { cct: filterValues.cct } : {}),
              ...(filterValues.cri?.min !== undefined || filterValues.cri?.max !== undefined ? { cri: filterValues.cri } : {}),
              ...(filterValues.lumens_output?.min !== undefined || filterValues.lumens_output?.max !== undefined ? { lumens_output: filterValues.lumens_output } : {}),
              ...(filterValues.voltage?.min !== undefined || filterValues.voltage?.max !== undefined ? { voltage: filterValues.voltage } : {}),
              ...(filterValues.beam_angle?.min !== undefined || filterValues.beam_angle?.max !== undefined ? { beam_angle: filterValues.beam_angle } : {}),
              // Categorical filters
              ...(filterValues.ip?.length ? { ip: filterValues.ip } : {}),
              ...(filterValues.finishing_colour?.length ? { finishing_colour: filterValues.finishing_colour } : {}),
              ...(filterValues.light_source?.length ? { light_source: filterValues.light_source } : {}),
              ...(filterValues.light_distribution?.length ? { light_distribution: filterValues.light_distribution } : {}),
              ...(filterValues.beam_angle_type?.length ? { beam_angle_type: filterValues.beam_angle_type } : {}),
              ...(filterValues.dimmable?.length ? { dimmable: filterValues.dimmable } : {}),
              ...(filterValues.class?.length ? { class: filterValues.class } : {})
            },
            page: currentPage - 1, // searchProductsAction uses 0-based page
            limit: pageSize
          })

          // Then get products
          const { products } = await searchProductsAction({
            categories: [currentCategory],
            suppliers: filterValues.supplier ? [filterValues.supplier.toString()] : undefined,
            indoor: filterValues.indoor ?? null,
            outdoor: filterValues.outdoor ?? null,
            submersible: filterValues.submersible ?? null,
            trimless: filterValues.trimless ?? null,
            cutShapeRound: filterValues.cut_shape_round ?? null,
            cutShapeRectangular: filterValues.cut_shape_rectangular ?? null,
            filters: {
              // Range filters
              ...(filterValues.cct?.min !== undefined || filterValues.cct?.max !== undefined ? { cct: filterValues.cct } : {}),
              ...(filterValues.cri?.min !== undefined || filterValues.cri?.max !== undefined ? { cri: filterValues.cri } : {}),
              ...(filterValues.lumens_output?.min !== undefined || filterValues.lumens_output?.max !== undefined ? { lumens_output: filterValues.lumens_output } : {}),
              ...(filterValues.voltage?.min !== undefined || filterValues.voltage?.max !== undefined ? { voltage: filterValues.voltage } : {}),
              ...(filterValues.beam_angle?.min !== undefined || filterValues.beam_angle?.max !== undefined ? { beam_angle: filterValues.beam_angle } : {}),
              // Categorical filters
              ...(filterValues.ip?.length ? { ip: filterValues.ip } : {}),
              ...(filterValues.finishing_colour?.length ? { finishing_colour: filterValues.finishing_colour } : {}),
              ...(filterValues.light_source?.length ? { light_source: filterValues.light_source } : {}),
              ...(filterValues.light_distribution?.length ? { light_distribution: filterValues.light_distribution } : {}),
              ...(filterValues.beam_angle_type?.length ? { beam_angle_type: filterValues.beam_angle_type } : {}),
              ...(filterValues.dimmable?.length ? { dimmable: filterValues.dimmable } : {}),
              ...(filterValues.class?.length ? { class: filterValues.class } : {})
            },
            page: currentPage - 1,
            limit: pageSize
          })

          // Map SearchProduct to ProductByTaxonomy format
          const mappedProducts: ProductByTaxonomy[] = products.map(p => ({
            product_id: p.product_id,
            foss_pid: p.foss_pid,
            description_short: p.description_short,
            description_long: p.description_long || '',
            supplier_name: p.supplier_name,
            prices: p.price_eur ? [{ date: '', disc1: 0, start_price: p.price_eur }] : []
          }))

          setProductResult({
            products: mappedProducts,
            total,
            page: currentPage,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
          })
        } else {
          // No dynamic filters - use the simpler taxonomy action
          const result = await getProductsByTaxonomyPaginatedAction(
            currentCategory,
            {
              page: currentPage,
              pageSize,
              supplierId: filterValues.supplier || undefined
            }
          )
          setProductResult(result)
        }
      } catch (error) {
        console.error('Error fetching products:', error)
        setProductResult(null)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [level1, level2, level3, filterValues, currentPage, pageSize, hasDynamicFilters])

  // Helper function to find category by code in dynamic taxonomy
  const findCategory = (code: string, categories: TaxonomyCategory[] = taxonomy): TaxonomyCategory | null => {
    for (const category of categories) {
      if (category.code === code) return category
      if (category.children) {
        const found = findCategory(code, category.children)
        if (found) return found
      }
    }
    return null
  }

  // Helper function to get breadcrumb trail
  const getBreadcrumbTrail = (code: string): string[] => {
    const category = findCategory(code)
    if (!category) return ['Home']

    const trail: string[] = []
    let current: TaxonomyCategory | null = category

    while (current) {
      trail.unshift(current.name)
      const parentCode: string | null = current.code.split('-').slice(0, -1).join('-') ||
                        (current.level === 2 ? current.code.split('-')[0] : null)
      current = parentCode ? findCategory(parentCode) : null
    }

    trail.unshift('Home')
    return trail
  }

  // Get categories for current level
  const level1Categories = taxonomy
  const level2Categories = level1
    ? taxonomy.find(cat => cat.code === level1)?.children || []
    : []
  const level3Categories = level2
    ? level2Categories.find(cat => cat.code === level2)?.children || []
    : []

  // Get current category for display
  const currentCategory = level3
    ? findCategory(level3)
    : level2
    ? findCategory(level2)
    : level1
    ? findCategory(level1)
    : null

  // Get breadcrumb
  const breadcrumb = currentCategory ? getBreadcrumbTrail(currentCategory.code) : ['Home']

  // Handle level changes
  const handleLevel1Change = (code: string) => {
    setLevel1(code)
    setLevel2(null)
    setLevel3(null)
  }

  const handleLevel2Change = (code: string) => {
    setLevel2(code)
    setLevel3(null)
  }

  const handleLevel3Change = (code: string) => {
    setLevel3(code)
  }

  // Redirect if unauthenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  if (!session && status !== 'loading') {
    return null
  }

  return (
    <ProtectedPageLayout>
      {(status === 'loading' || taxonomyLoading) ? (
        <div className="flex items-center justify-center flex-1">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
      {/* Level 1: Horizontal cards */}
      <CategoryLevel1
        categories={level1Categories}
        activeCategory={level1}
        onCategoryChange={handleLevel1Change}
      />

      {/* Level 2: Horizontal Tabs */}
      {level1 && level2Categories.length > 0 && (
        <div className="border-b bg-muted/30">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold flex items-center">
                Subcategories
                <InfoTooltip
                  content="Select a subcategory to refine your search and see more specific product types."
                  side="right"
                />
              </h3>
            </div>

            <Tabs value={level2 || ''} onValueChange={handleLevel2Change}>
              <TabsList className="w-full justify-start h-auto flex-wrap">
                {level2Categories.map((category) => {
                  const IconComponent = (LucideIcons[category.icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>) || LucideIcons.Box

                  return (
                    <TabsTrigger
                      key={category.code}
                      value={category.code}
                      className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all hover:bg-primary/10 hover:scale-105"
                    >
                      <IconComponent className="h-4 w-4" />
                      <span>{category.name}</span>
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {category.productCount}
                      </Badge>
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </Tabs>
          </div>
        </div>
      )}

      {/* Level 3: Horizontal Tabs */}
      {level2 && level3Categories.length > 0 && (
        <div className="border-b bg-muted/20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium flex items-center">
                Product Types
                <InfoTooltip
                  content="Select a specific product type to narrow down your search results."
                  side="right"
                />
              </h4>
            </div>

            <Tabs value={level3 || ''} onValueChange={handleLevel3Change}>
              <TabsList className="w-full justify-start h-auto flex-wrap">
                {level3Categories.map((category) => {
                  const IconComponent = (LucideIcons[category.icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>) || LucideIcons.Box

                  return (
                    <TabsTrigger
                      key={category.code}
                      value={category.code}
                      className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all hover:bg-primary/10 hover:scale-105"
                    >
                      <IconComponent className="h-4 w-4" />
                      <span>{category.name}</span>
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {category.productCount}
                      </Badge>
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </Tabs>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      {currentCategory && (
        <div className="px-6 py-3 bg-muted/10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {breadcrumb.map((crumb, index) => (
              <div key={index} className="flex items-center gap-2">
                <span>{crumb}</span>
                {index < breadcrumb.length - 1 && (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content: Filters + Products */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filter Panel (left sidebar on desktop) */}
          <aside className="lg:w-80">
            <FilterPanel
              taxonomyCode={currentCategory?.code}
              values={filterValues}
              onChange={setFilterValues}
            />
          </aside>

          {/* Product Grid */}
          <main className="flex-1">
            {loading ? (
              <>
                <Skeleton className="h-6 w-64 mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-5 w-full mb-2" />
                        <Skeleton className="h-4 w-32" />
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-6 w-24" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : !currentCategory ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">
                  Select a category to browse products
                </p>
              </div>
            ) : productResult && productResult.products.length > 0 ? (
              <>
                <div className="mb-4 text-sm text-muted-foreground">
                  Showing {productResult.products.length} of {productResult.total} product{productResult.total !== 1 ? 's' : ''} (Page {currentPage} of {productResult.totalPages})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {productResult.products.map((product) => (
                    <Card
                      key={product.product_id}
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => router.push(`/products/${product.product_id}`)}
                    >
                      <CardHeader>
                        <CardTitle className="text-base line-clamp-2">
                          {product.description_short}
                        </CardTitle>
                        <CardDescription className="line-clamp-1">
                          {product.supplier_name}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">{product.foss_pid}</Badge>
                          {product.prices && product.prices.length > 0 && (
                            <span className="text-sm font-semibold">
                              €{product.prices[0].start_price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {productResult.totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage(currentPage - 1)}
                            aria-disabled={currentPage === 1 || loading}
                            className={currentPage === 1 || loading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>

                        <span className="flex items-center px-4 text-sm text-muted-foreground">
                          Page {currentPage} of {productResult.totalPages}
                        </span>

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(currentPage + 1)}
                            aria-disabled={currentPage === productResult.totalPages || loading}
                            className={currentPage === productResult.totalPages || loading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-lg font-semibold mb-2">No products found</h3>
                  <p className="text-muted-foreground mb-4">
                    {Object.keys(filterValues).length > 0
                      ? 'Try adjusting your filters or clearing some selections'
                      : 'No products match the selected category'}
                  </p>
                  {Object.keys(filterValues).length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setFilterValues({})}
                      className="mt-2"
                    >
                      Clear all filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>
        </>
      )}
    </ProtectedPageLayout>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <ProtectedPageLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Spinner size="lg" />
        </div>
      </ProtectedPageLayout>
    }>
      <ProductsPageContent />
    </Suspense>
  )
}
