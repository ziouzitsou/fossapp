'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDevSession } from '@/lib/use-dev-session'
import Image from 'next/image'
import { FaSignOutAlt, FaChevronDown, FaBars, FaTimes, FaSearch, FaHistory, FaTrash } from 'react-icons/fa'
import { ThemeToggle } from '@/components/theme-toggle'
import { getNavigation } from '@/lib/navigation'
import { VersionDisplay } from '@/components/version-display'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  searchCustomersAction,
  listCustomersAction,
  type CustomerSearchResult,
  type CustomerListResult
} from '@/lib/actions'

export default function CustomersPage() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
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

  const handleCustomerClick = (customerId: string) => {
    router.push(`/customers/${customerId}`)
  }

  const handlePageChange = (newPage: number) => {
    loadAllCustomers(newPage)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const navigation = getNavigation('/customers')

  const displayCustomers = showAllCustomers && customerList ? customerList.customers : searchResults

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
              const Icon = item.icon
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
                  <Icon className="mr-3 h-5 w-5" />
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
              {/* Theme Toggle */}
              <ThemeToggle />

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

                {/* Dropdown menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-popover rounded-md shadow-lg py-1 z-50 border">
                    <div className="px-4 py-2 border-b">
                      <p className="text-sm font-medium text-popover-foreground">{session.user?.name}</p>
                      <p className="text-sm text-muted-foreground">{session.user?.email}</p>
                    </div>
                    <button
                      onClick={() => signOut()}
                      className="w-full text-left px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                    >
                      <FaSignOutAlt className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-auto p-6">
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
                  <Input
                    type="text"
                    placeholder="Search customers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={() => handleSearch()} disabled={isLoading}>
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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
                    <div className="flex justify-center items-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || isLoading}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {customerList.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === customerList.totalPages || isLoading}
                      >
                        Next
                      </Button>
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
        </main>
      </div>
    </div>
  )
}
