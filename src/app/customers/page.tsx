'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDevSession } from '@/lib/use-dev-session'
import { FaSearch, FaHistory, FaTrash } from 'react-icons/fa'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { CommandPalette, useCommandPalette } from '@/components/command-palette'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'
import {
  searchCustomersAction,
  listCustomersAction,
  type CustomerSearchResult,
  type CustomerListResult
} from '@/lib/actions'

export default function CustomersPage() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [customerList, setCustomerList] = useState<CustomerListResult | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAllCustomers, setShowAllCustomers] = useState(false)

  // Load search history from localStorage on mount
  useEffect(() => {
    const history = localStorage.getItem('customerSearchHistory')
    if (history) {
      try {
        setSearchHistory(JSON.parse(history))
      } catch (error) {
        console.error('Error loading search history:', error)
      }
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  // Load all customers when showAllCustomers is toggled
  useEffect(() => {
    if (showAllCustomers && status === 'authenticated') {
      loadAllCustomers(1)
    }
  }, [showAllCustomers, status])

  const loadAllCustomers = async (page: number) => {
    setIsLoading(true)
    try {
      const result = await listCustomersAction({
        page,
        pageSize: 20,
        sortBy: 'name',
        sortOrder: 'asc'
      })
      setCustomerList(result)
      setCurrentPage(page)
    } catch (error) {
      console.error('Load customers error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery
    if (!searchTerm.trim()) return

    // Update search query if using history
    if (query) {
      setSearchQuery(query)
    }

    setIsLoading(true)
    setShowAllCustomers(false)
    try {
      const results = await searchCustomersAction(searchTerm)
      setSearchResults(results)

      // Update search history
      const updatedHistory = [
        searchTerm,
        ...searchHistory.filter(item => item !== searchTerm)
      ].slice(0, 10)

      setSearchHistory(updatedHistory)
      localStorage.setItem('customerSearchHistory', JSON.stringify(updatedHistory))
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const clearSearchHistory = () => {
    setSearchHistory([])
    localStorage.removeItem('customerSearchHistory')
  }

  // Handle command palette search
  const handleCommandSearch = (query: string) => {
    handleSearch(query)
  }

  const handleCustomerClick = (customerId: string) => {
    router.push(`/customers/${customerId}`)
  }

  const handlePageChange = (newPage: number) => {
    loadAllCustomers(newPage)
  }

  if (!session && status !== 'loading') {
    return null
  }

  const displayCustomers = showAllCustomers && customerList ? customerList.customers : searchResults

  return (
    <ProtectedPageLayout>
      {status === 'loading' ? (
        <div className="flex items-center justify-center flex-1">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground">Customers</h1>
              <p className="text-muted-foreground mt-2">Search and manage your customer database.</p>
            </div>

            {/* Search Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Search Customers</CardTitle>
                <CardDescription>Enter customer name, code, email, or city to find customers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      placeholder="Search customers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      onFocus={() => setCommandOpen(true)}
                      className="pr-16"
                    />
                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </div>
                  <Button onClick={() => handleSearch()} disabled={isLoading}>
                    {isLoading ? (
                      <Spinner size="sm" className="text-white" />
                    ) : (
                      <FaSearch className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAllCustomers(!showAllCustomers)}
                  >
                    {showAllCustomers ? 'Hide All' : 'Show All'}
                  </Button>
                </div>

                {/* Search History */}
                {searchHistory.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FaHistory className="h-3 w-3" />
                        <span>Recent searches</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSearchHistory}
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <FaTrash className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchHistory.map((term, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary/20 transition-colors"
                          onClick={() => handleSearch(term)}
                        >
                          {term}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer Results */}
            {displayCustomers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {showAllCustomers ? 'All Customers' : 'Search Results'}
                  </CardTitle>
                  <CardDescription>
                    {showAllCustomers && customerList
                      ? `Showing ${displayCustomers.length} of ${customerList.total} customers (Page ${currentPage} of ${customerList.totalPages})`
                      : `${displayCustomers.length} customers found`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {displayCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        onClick={() => handleCustomerClick(customer.id)}
                        className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{customer.name}</h3>
                            {customer.name_en && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {customer.name_en}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground mt-1">
                              Code: {customer.customer_code}
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {customer.city && (
                                <Badge variant="secondary">{customer.city}</Badge>
                              )}
                              {customer.industry && (
                                <Badge variant="outline">{customer.industry}</Badge>
                              )}
                              {customer.company_type && (
                                <Badge variant="outline">{customer.company_type}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            {customer.email && <div>{customer.email}</div>}
                            {customer.phone && <div>{customer.phone}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {showAllCustomers && customerList && customerList.totalPages > 1 && (
                    <div className="mt-6">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => handlePageChange(currentPage - 1)}
                              aria-disabled={currentPage === 1 || isLoading}
                              className={currentPage === 1 || isLoading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                          </PaginationItem>

                          <span className="flex items-center px-4 text-sm text-muted-foreground">
                            Page {currentPage} of {customerList.totalPages}
                          </span>

                          <PaginationItem>
                            <PaginationNext
                              onClick={() => handlePageChange(currentPage + 1)}
                              aria-disabled={currentPage === customerList.totalPages || isLoading}
                              className={currentPage === customerList.totalPages || isLoading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {searchQuery && searchResults.length === 0 && !isLoading && !showAllCustomers && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No customers found for &quot;{searchQuery}&quot;</p>
                  <p className="text-sm text-muted-foreground mt-2">Try a different search term</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Command Palette */}
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        searchHistory={searchHistory}
        onSearch={handleCommandSearch}
        placeholder="Search customers..."
        emptyMessage="Type to search customers by name, code, email, or city..."
      />
    </ProtectedPageLayout>
  )
}
