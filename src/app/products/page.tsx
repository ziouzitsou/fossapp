'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { useDevSession } from '@/lib/use-dev-session'
import Image from 'next/image'
import {
  FaSignOutAlt,
  FaChevronDown,
  FaSearch,
  FaBars,
  FaTimes,
  FaLightbulb,
  FaTools,
  FaSlidersH,
  FaPlug,
  FaBoxes,
  FaSun,
  FaMoon,
  FaDesktop,
  FaCheck
} from 'react-icons/fa'
import { Loader2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { getNavigation } from '@/lib/navigation'
import { VersionDisplay } from '@/components/version-display'
import { IconMapper } from '@/components/icon-mapper'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

// Advanced search imports
import type { SearchFilters, SearchProduct, TaxonomyNode, FilterDefinition } from '@/types/search'
import {
  searchProductsAction,
  countProductsAction,
  getTaxonomyTreeAction,
  getFilterDefinitionsAction,
} from '@/lib/search-actions'
import { buildTaxonomyTree, getDescendantCodes } from '@/lib/search-utils'

// Color mapping for categories (frontend styling)
const CATEGORY_COLORS: Record<string, string> = {
  'LUMINAIRE': 'from-amber-500 to-orange-500',
  'ACCESSORIES': 'from-blue-500 to-cyan-500',
  'DRIVERS': 'from-green-500 to-emerald-500',
  'LAMPS': 'from-yellow-500 to-orange-500',
  'MISC': 'from-gray-500 to-slate-500'
}

export default function ProductsPage() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  // Root categories from database (level 1 taxonomy)
  const [rootCategories, setRootCategories] = useState<Array<{
    code: string
    name: string
    description: string | null
    icon: string | null
    color: string
    display_order: number
  }>>([])

  // Active root category state
  const [activeRootCategory, setActiveRootCategory] = useState<string>('')

  // Search state
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    categories: [],
    sortBy: 'relevance',
    page: 0,
    limit: 20
  })

  // Results state
  const [results, setResults] = useState<SearchProduct[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // Taxonomy state
  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>([])
  const [taxonomyTree, setTaxonomyTree] = useState<TaxonomyNode[]>([])

  // Filter definitions state
  const [filterDefinitions, setFilterDefinitions] = useState<FilterDefinition[]>([])

  // Search history
  const [searchHistory, setSearchHistory] = useState<string[]>([])

  // Get active category info
  const activeCategoryInfo = rootCategories.find(cat => cat.code === activeRootCategory)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('productSearchHistory')
    if (history) {
      try {
        setSearchHistory(JSON.parse(history))
      } catch (error) {
        console.error('Error loading search history:', error)
      }
    }
  }, [])

  // Load taxonomy tree and root categories
  useEffect(() => {
    async function loadTaxonomy() {
      const nodes = await getTaxonomyTreeAction()
      setTaxonomyNodes(nodes)
      const tree = buildTaxonomyTree(nodes)
      setTaxonomyTree(tree)

      // Build root categories from level 1 taxonomy nodes
      const level1Nodes = nodes
        .filter(n => n.level === 1)
        .map(n => ({
          code: n.code,
          name: n.name,
          description: n.description || null,
          icon: n.icon || null,
          color: CATEGORY_COLORS[n.code] || 'from-gray-500 to-slate-500',
          display_order: n.display_order || 0
        }))
        .sort((a, b) => a.display_order - b.display_order)

      setRootCategories(level1Nodes)

      // Set initial active category to first one
      if (level1Nodes.length > 0) {
        setActiveRootCategory(level1Nodes[0].code)
      }
    }
    loadTaxonomy()
  }, [])

  // Load filter definitions
  useEffect(() => {
    async function loadFilters() {
      const definitions = await getFilterDefinitionsAction()
      setFilterDefinitions(definitions)
    }
    loadFilters()
  }, [])

  // Redirect if unauthenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  // Debounced search effect with root category filter
  useEffect(() => {
    const timer = setTimeout(async () => {
      await performSearch()
    }, 300)

    return () => clearTimeout(timer)
  }, [filters, activeRootCategory])

  // Clear filters when switching categories
  const clearFiltersForNewCategory = () => {
    setFilters({
      query: '',
      categories: [],
      sortBy: 'relevance',
      page: 0,
      limit: 20
    })
    setResults([])
    setTotalCount(0)
  }

  // Perform search
  const performSearch = async () => {
    setIsLoading(true)

    try {
      // Build category filter based on active root category
      // Get all descendant codes for this root category
      const rootCategoryFilter = getDescendantCodes(taxonomyNodes, activeRootCategory)

      // Merge user-selected categories with root category filter
      const searchFilters: SearchFilters = {
        ...filters,
        categories: filters.categories?.length
          ? filters.categories
          : rootCategoryFilter
      }

      // Search and count in parallel
      const [searchResult, count] = await Promise.all([
        searchProductsAction(searchFilters),
        countProductsAction(searchFilters)
      ])

      setResults(searchResult.products)
      setTotalCount(count)

      // Save to search history if there's a query
      if (filters.query && filters.query.trim()) {
        const newHistory = [
          filters.query,
          ...searchHistory.filter(q => q !== filters.query)
        ].slice(0, 10)
        setSearchHistory(newHistory)
        localStorage.setItem('productSearchHistory', JSON.stringify(newHistory))
      }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, query: value, page: 0 }))
  }

  // Handle sort change
  const handleSortChange = (value: string) => {
    setFilters(prev => ({ ...prev, sortBy: value as any, page: 0 }))
  }

  // Handle boolean filter toggle
  const handleBooleanFilterToggle = (filterKey: string) => {
    // Convert snake_case to camelCase for SearchFilters compatibility
    const camelCaseKey = filterKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

    setFilters(prev => ({
      ...prev,
      [camelCaseKey]: prev[camelCaseKey as keyof SearchFilters] === true ? undefined : true,
      page: 0
    }))
  }

  // Get filter value (handles camelCase conversion)
  const getFilterValue = (filterKey: string): boolean | undefined => {
    const camelCaseKey = filterKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    return filters[camelCaseKey as keyof SearchFilters] as boolean | undefined
  }

  // Get filters applicable to the current category
  const applicableFilters = useMemo(() => {
    return filterDefinitions.filter(filter => {
      // If applicable_taxonomy_codes is null or empty, don't show (no category)
      if (!filter.applicable_taxonomy_codes || filter.applicable_taxonomy_codes.length === 0) {
        return false
      }
      // Check if current category is in the applicable list
      return filter.applicable_taxonomy_codes.includes(activeRootCategory)
    })
  }, [filterDefinitions, activeRootCategory])

  // Group filters by their group field
  const filtersByGroup = useMemo(() => {
    const groups: Record<string, FilterDefinition[]> = {
      Location: [],
      Options: [],
      Electricals: [],
      Design: [],
      Light: []
    }

    applicableFilters.forEach(filter => {
      if (filter.group && groups[filter.group]) {
        groups[filter.group].push(filter)
      }
    })

    return groups
  }, [applicableFilters])

  // Get groups that have at least one filter (for current category)
  const availableGroups = useMemo(() => {
    return Object.entries(filtersByGroup)
      .filter(([_, filters]) => filters.length > 0)
      .map(([group]) => group)
  }, [filtersByGroup])

  // Get the default tab (first available group)
  const defaultTab = useMemo(() => {
    return availableGroups.length > 0 ? availableGroups[0] : 'Location'
  }, [availableGroups])

  // Count active filters per group
  const activeFilterCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    Object.keys(filtersByGroup).forEach(group => {
      counts[group] = filtersByGroup[group].filter(f =>
        f.filter_type === 'boolean' && getFilterValue(f.filter_key) === true
      ).length
    })
    return counts
  }, [filtersByGroup, filters])

  // Check if any filters are active
  const hasActiveFilters = applicableFilters
    .filter(f => f.filter_type === 'boolean')
    .some(f => getFilterValue(f.filter_key) === true)

  // Clear all filters
  const handleClearFilters = () => {
    setFilters({
      query: filters.query, // Keep search query
      categories: [],
      sortBy: 'relevance',
      page: 0,
      limit: 20
    })
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  const navigation = getNavigation('/products')

  return (
    <div className="h-screen flex bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-30 w-64 bg-card shadow-lg border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col`}>
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <div className="flex items-center">
            <Image
              src="/logo.svg"
              alt="Company Logo"
              width={80}
              height={80}
              className="h-20 w-20 dark:hidden"
            />
            <Image
              src="/logo-dark.svg"
              alt="Company Logo"
              width={80}
              height={80}
              className="h-20 w-20 hidden dark:block"
            />
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <FaTimes className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-8 flex-1">
          <div className="px-3">
            {navigation.map((item) => {
              const NavIcon = item.icon
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`${
                    item.current
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  } group flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 transition-colors`}
                >
                  <NavIcon className="mr-3 h-5 w-5" />
                  {item.name}
                </a>
              )
            })}
          </div>
        </nav>

        {/* Version display at bottom */}
        <div className="border-t">
          <VersionDisplay />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-card shadow-sm border-b">
          <div className="flex items-center h-16 px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-muted-foreground hover:text-foreground"
            >
              <FaBars className="h-5 w-5" />
            </button>

            <div className="flex-1" />

            {/* Right side items */}
            <div className="flex items-center gap-4">
              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 text-sm rounded-full hover:bg-accent p-2 transition-colors"
                >
                  <div className="relative w-8 h-8">
                    <Image
                      src={session.user?.image || '/default-avatar.png'}
                      alt="Profile"
                      fill
                      sizes="32px"
                      className="rounded-full object-cover"
                    />
                  </div>
                  <span className="hidden md:block font-medium text-foreground">
                    {session.user?.name}
                  </span>
                  <FaChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>

                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-popover rounded-md shadow-lg py-1 z-50 border">
                      <div className="px-4 py-2 border-b">
                        <p className="text-sm font-medium text-popover-foreground">{session.user?.name}</p>
                        <p className="text-sm text-muted-foreground">{session.user?.email}</p>
                      </div>

                      {/* Theme options */}
                      {mounted && (
                        <>
                          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Theme
                          </div>
                          {[
                            { name: 'Light', value: 'light', icon: FaSun },
                            { name: 'Dark', value: 'dark', icon: FaMoon },
                            { name: 'System', value: 'system', icon: FaDesktop },
                          ].map((themeOption) => {
                            const Icon = themeOption.icon
                            const isActive = theme === themeOption.value
                            return (
                              <button
                                key={themeOption.value}
                                onClick={() => {
                                  setTheme(themeOption.value)
                                  setDropdownOpen(false)
                                }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 justify-between"
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  <span>{themeOption.name}</span>
                                </div>
                                {isActive && <FaCheck className="h-3 w-3 text-primary" />}
                              </button>
                            )
                          })}
                          <div className="my-1 border-t" />
                        </>
                      )}

                      {/* Sign out */}
                      <button
                        onClick={() => signOut()}
                        className="w-full text-left px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                      >
                        <FaSignOutAlt className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Category Navigation - Horizontal Scrolling Cards */}
        <div className="border-b bg-muted/50">
          <div className="px-6 py-4">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-3 py-2 px-3">
                {rootCategories.map((category) => {
                  const isActive = category.code === activeRootCategory

                  return (
                    <button
                      key={category.code}
                      onClick={() => {
                        setActiveRootCategory(category.code)
                        clearFiltersForNewCategory()
                      }}
                      className={cn(
                        "flex-shrink-0 p-4 rounded-lg border-2 transition-all min-w-[200px]",
                        isActive
                          ? `border-primary bg-gradient-to-br ${category.color} text-white shadow-lg scale-105`
                          : "border-border hover:border-primary/50 bg-background"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <IconMapper name={category.icon} className="w-8 h-8" />
                        <div className="text-left">
                          <div className="font-semibold">{category.name}</div>
                          <div className={cn("text-xs", isActive ? "text-white/80" : "text-muted-foreground")}>
                            {category.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Search and Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={`Search ${activeCategoryInfo?.name || 'products'}...`}
                value={filters.query}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Sort */}
            <Select value={filters.sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filters - Tabbed by Group (only show if there are filters for this category) */}
          {availableGroups.length > 0 && (
            <Tabs defaultValue={defaultTab} className="w-full mb-4">
              <div className="flex items-center justify-between mb-2">
                <TabsList className={cn(
                  "grid w-full max-w-2xl",
                  availableGroups.length === 1 && "grid-cols-1",
                  availableGroups.length === 2 && "grid-cols-2",
                  availableGroups.length === 3 && "grid-cols-3",
                  availableGroups.length === 4 && "grid-cols-4",
                  availableGroups.length === 5 && "grid-cols-5"
                )}>
                  {availableGroups.map(group => (
                    <TabsTrigger key={group} value={group}>
                      {group}
                      {activeFilterCounts[group] > 0 && (
                        <span className="ml-1 text-xs">({activeFilterCounts[group]})</span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Clear filters button */}
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={handleClearFilters}>
                    Clear All
                  </Button>
                )}
              </div>

              {/* Tab Content for each available group */}
              {availableGroups.map(group => {
                const filters = filtersByGroup[group]
                return (
                  <TabsContent key={group} value={group} className="mt-2">
                    <div className="flex flex-wrap gap-2">
                      {filters
                        .filter(f => f.filter_type === 'boolean')
                        .map(filter => (
                          <div key={filter.filter_key} className="flex items-center gap-2 p-2 rounded-md border bg-background">
                            <Checkbox
                              id={filter.filter_key}
                              checked={getFilterValue(filter.filter_key) === true}
                              onCheckedChange={() => handleBooleanFilterToggle(filter.filter_key)}
                            />
                            <Label htmlFor={filter.filter_key} className="cursor-pointer text-sm">
                              {filter.label}
                            </Label>
                          </div>
                        ))}

                      {/* Placeholder for range/categorical filters */}
                      {filters.filter(f => f.filter_type !== 'boolean').length > 0 && (
                        <div className="w-full p-3 text-sm text-muted-foreground border rounded-md bg-muted/50">
                          {filters.filter(f => f.filter_type !== 'boolean').length} range/categorical filter(s) - Coming soon
                        </div>
                      )}
                    </div>
                  </TabsContent>
                )
              })}
            </Tabs>
          )}

          {/* No filters message */}
          {availableGroups.length === 0 && (
            <div className="p-4 mb-4 text-sm text-muted-foreground bg-muted/50 rounded-md border">
              No filters available for this category
            </div>
          )}

          {/* Results Count */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {isLoading ? (
                'Searching...'
              ) : (
                `${totalCount} product${totalCount !== 1 ? 's' : ''} found`
              )}
            </div>
          </div>

          {/* Results Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {results.map((product) => (
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
                        {product.price_eur && (
                          <span className="text-sm font-semibold">
                            €{product.price_eur.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {(product.indoor || product.outdoor || product.submersible) && (
                        <div className="flex gap-1 mt-2">
                          {product.indoor && <Badge variant="outline" className="text-xs">Indoor</Badge>}
                          {product.outdoor && <Badge variant="outline" className="text-xs">Outdoor</Badge>}
                          {product.submersible && <Badge variant="outline" className="text-xs">Submersible</Badge>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalCount > filters.limit! && (
                <div className="mt-8 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => {
                            if (filters.page! > 0) {
                              setFilters(prev => ({ ...prev, page: prev.page! - 1 }))
                            }
                          }}
                          className={filters.page === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>

                      {/* Page Numbers */}
                      {(() => {
                        const totalPages = Math.ceil(totalCount / filters.limit!)
                        const currentPage = filters.page!
                        const pages: (number | 'ellipsis')[] = []

                        // Always show first page
                        pages.push(0)

                        // Show pages around current page
                        const startPage = Math.max(1, currentPage - 1)
                        const endPage = Math.min(totalPages - 1, currentPage + 1)

                        // Add ellipsis if needed
                        if (startPage > 1) {
                          pages.push('ellipsis')
                        }

                        // Add pages around current
                        for (let i = startPage; i <= endPage; i++) {
                          if (i !== 0 && i !== totalPages - 1) {
                            pages.push(i)
                          }
                        }

                        // Add ellipsis if needed
                        if (endPage < totalPages - 2) {
                          pages.push('ellipsis')
                        }

                        // Always show last page if more than 1 page
                        if (totalPages > 1) {
                          pages.push(totalPages - 1)
                        }

                        return pages.map((page, idx) => (
                          page === 'ellipsis' ? (
                            <PaginationItem key={`ellipsis-${idx}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setFilters(prev => ({ ...prev, page }))}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page + 1}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        ))
                      })()}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => {
                            const totalPages = Math.ceil(totalCount / filters.limit!)
                            if (filters.page! < totalPages - 1) {
                              setFilters(prev => ({ ...prev, page: prev.page! + 1 }))
                            }
                          }}
                          className={filters.page! >= Math.ceil(totalCount / filters.limit!) - 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No products found in this category</p>
              {filters.query && (
                <p className="text-sm text-muted-foreground mt-2">
                  Try adjusting your search or filters
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
