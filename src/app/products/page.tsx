'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDevSession } from '@/lib/use-dev-session'
import Image from 'next/image'
import { FaSignOutAlt, FaChevronDown, FaBars, FaTimes, FaSearch } from 'react-icons/fa'
import { MdDashboard, MdWork } from 'react-icons/md'
import { ThemeToggle } from '@/components/theme-toggle'
import { VersionDisplay } from '@/components/version-display'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { searchProducts, ProductSearchResult } from '@/lib/supabase'

export default function ProductsPage() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsLoading(true)
    try {
      const results = await searchProducts(searchQuery)
      setSearchResults(results)
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`)
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

  const navigation = [
    { name: 'Dashboard', icon: MdDashboard, href: '/dashboard', current: false },
    { name: 'Products', icon: MdWork, href: '/products', current: true },
    { name: 'Projects', icon: MdWork, href: '/projects', current: false },
  ]

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
              <h1 className="text-2xl font-bold text-foreground">Products</h1>
              <p className="text-muted-foreground mt-2">Search and explore our product catalog.</p>
            </div>
            
            {/* Search Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Search Products</CardTitle>
                <CardDescription>Enter product name, model, or description to find products</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={isLoading}>
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <FaSearch className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Search Results</CardTitle>
                  <CardDescription>{searchResults.length} products found</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {searchResults.map((product) => (
                      <div
                        key={product.product_id}
                        onClick={() => handleProductClick(product.product_id)}
                        className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{product.description_short}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Model: {product.foss_pid}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary">{product.supplier_name}</Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            {product.prices.length > 0 && (
                              <div className="text-sm">
                                <span className="font-medium">€{product.prices[0].start_price}</span>
                                {product.prices[0].disc1 > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    -{product.prices[0].disc1}% disc
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {searchQuery && searchResults.length === 0 && !isLoading && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No products found for &quot;{searchQuery}&quot;</p>
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