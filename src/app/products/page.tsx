'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDevSession } from '@/lib/use-dev-session'
import {
  realTaxonomy,
  findCategoryByCode,
  getBreadcrumb,
  type TaxonomyCategory
} from '@/lib/real-taxonomy-data'
import {
  getProductsByTaxonomyAction,
  type ProductByTaxonomy
} from '@/lib/actions'
import { CategoryLevel1 } from '@/components/products/CategoryLevel1'
import { SupplierFilter } from '@/components/products/SupplierFilter'
import { InfoTooltip } from '@/components/products/InfoTooltip'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, ChevronRight } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ProductsPage() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get URL state
  const [level1, setLevel1] = useState<string | null>(searchParams.get('level1'))
  const [level2, setLevel2] = useState<string | null>(searchParams.get('level2'))
  const [level3, setLevel3] = useState<string | null>(searchParams.get('level3'))
  const [supplierId, setSupplierId] = useState<number | null>(
    searchParams.get('supplier') ? Number(searchParams.get('supplier')) : null
  )

  // Products state
  const [products, setProducts] = useState<ProductByTaxonomy[]>([])
  const [loading, setLoading] = useState(false)

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (level1) params.set('level1', level1)
    if (level2) params.set('level2', level2)
    if (level3) params.set('level3', level3)
    if (supplierId) params.set('supplier', supplierId.toString())

    router.replace(`/products?${params.toString()}`, { scroll: false })
  }, [level1, level2, level3, supplierId, router])

  // Fetch products when taxonomy or supplier changes
  useEffect(() => {
    async function fetchProducts() {
      const currentCategory = level3 || level2 || level1
      if (!currentCategory) {
        setProducts([])
        return
      }

      setLoading(true)
      try {
        const result = await getProductsByTaxonomyAction(
          currentCategory,
          supplierId || undefined
        )
        setProducts(result)
      } catch (error) {
        console.error('Error fetching products:', error)
        setProducts([])
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [level1, level2, level3, supplierId])

  // Get categories for current level
  const level1Categories = realTaxonomy
  const level2Categories = level1
    ? realTaxonomy.find(cat => cat.code === level1)?.children || []
    : []
  const level3Categories = level2
    ? level2Categories.find(cat => cat.code === level2)?.children || []
    : []

  // Get current category for display
  const currentCategory = level3
    ? findCategoryByCode(level3)
    : level2
    ? findCategoryByCode(level2)
    : level1
    ? findCategoryByCode(level1)
    : null

  // Get breadcrumb
  const breadcrumb = currentCategory ? getBreadcrumb(currentCategory.code) : ['Home']

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

  const handleSupplierChange = (id: number | null) => {
    setSupplierId(id)
  }

  // Redirect if unauthenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <ProtectedPageLayout>
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
                      className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
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

      {/* Level 3: Dropdown Menu */}
      {level2 && level3Categories.length > 0 && (
        <div className="border-b bg-muted/20">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium flex items-center">
                  Product Types
                  <InfoTooltip
                    content="Select a specific product type to narrow down your search results."
                    side="right"
                  />
                </h4>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    {level3
                      ? findCategoryByCode(level3)?.name
                      : 'Select type'}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {level3Categories.map((category) => {
                    const IconComponent = (LucideIcons[category.icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>) || LucideIcons.Box

                    return (
                      <DropdownMenuItem
                        key={category.code}
                        onClick={() => handleLevel3Change(category.code)}
                        className="gap-2"
                      >
                        <IconComponent className="h-4 w-4" />
                        <span>{category.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {category.productCount}
                        </span>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Supplier Filter */}
                <SupplierFilter
                  selectedSupplierId={supplierId}
                  onSupplierChange={handleSupplierChange}
                />
              </CardContent>
            </Card>
          </aside>

          {/* Product Grid */}
          <main className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : !currentCategory ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">
                  Select a category to browse products
                </p>
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="mb-4 text-sm text-muted-foreground">
                  {products.length} product{products.length !== 1 ? 's' : ''} found
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {products.map((product) => (
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
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No products found in this category
                </p>
                {supplierId && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Try removing the supplier filter
                  </p>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedPageLayout>
  )
}
