'use client'

import { useRouter, useParams } from 'next/navigation'
import { useDevSession } from '@/lib/use-dev-session'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { FaSignOutAlt, FaChevronDown, FaBars, FaTimes, FaArrowLeft, FaExternalLinkAlt } from 'react-icons/fa'
import { MdDashboard, MdWork } from 'react-icons/md'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ProductDetail {
  product_id: string
  foss_pid: string
  description_short: string
  description_long: string
  supplier_name: string
  supplier_logo?: string
  supplier_logo_dark?: string
  class_name?: string
  family?: string
  subfamily?: string
  prices: Array<{
    date: string
    disc1: number
    start_price: number
  }>
  multimedia?: Array<{
    mime_code: string
    mime_source: string
  }>
  features?: Array<{
    feature_name: string
    fvalueC_desc?: string
    fvalueN?: number
    unit_abbrev?: string
    fvalueB?: boolean
  }>
}

export default function ProductDetailPage() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const params = useParams()
  const { resolvedTheme } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [logoError, setLogoError] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (params?.id) {
      loadProduct(params.id as string)
    }
  }, [params?.id])

  const loadProduct = async (productId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/products/${productId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch product: ${response.status}`)
      }
      
      const result = await response.json()
      setProduct(result.data)
    } catch (error) {
      console.error('Error loading product:', error)
      setProduct(null)
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoading) {
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
    { name: 'Projects', icon: MdDashboard, href: '/dashboard', current: false },
    { name: 'Products', icon: MdWork, href: '/products', current: true },
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
      } fixed inset-y-0 left-0 z-30 w-64 bg-card shadow-lg border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
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
        
        <nav className="mt-8">
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
                      onClick={() => router.push('/')}
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
          <div className="max-w-6xl mx-auto">
            {/* Back button */}
            <div className="mb-6">
              <Button 
                variant="ghost" 
                onClick={() => router.back()}
                className="gap-2"
              >
                <FaArrowLeft className="h-4 w-4" />
                Back to Products
              </Button>
            </div>

            {product && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Product Image */}
                <Card>
                  <CardContent className="p-6">
                    {product.multimedia && product.multimedia.length > 0 && !imageError ? (
                      <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100">
                        <Image
                          src={product.multimedia[0].mime_source}
                          alt={product.description_short}
                          fill
                          loading="eager"
                          className="object-contain"
                          sizes="(max-width: 768px) 100vw, 50vw"
                          onError={() => setImageError(true)}
                        />
                      </div>
                    ) : (
                      <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                        <Image
                          src="/missing-product-image.png"
                          alt="No image available"
                          width={400}
                          height={400}
                          className="object-contain opacity-50"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Product Info */}
                <div className="space-y-6">
                  {/* Basic Info */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl">{product.description_short}</CardTitle>
                          <CardDescription className="mt-2">
                            Model: {product.foss_pid}
                          </CardDescription>
                        </div>
                        {mounted && !logoError && (product.supplier_logo || product.supplier_logo_dark) && (() => {
                          const logoUrl = resolvedTheme === 'dark' && product.supplier_logo_dark
                            ? product.supplier_logo_dark
                            : product.supplier_logo
                          return logoUrl ? (
                            <Image
                              src={logoUrl}
                              alt={product.supplier_name}
                              width={60}
                              height={40}
                              style={{ height: 'auto' }}
                              className="object-contain"
                              onError={() => setLogoError(true)}
                            />
                          ) : null
                        })()}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{product.supplier_name}</Badge>
                          {product.family && <Badge variant="outline">{product.family}</Badge>}
                          {product.class_name && <Badge variant="outline">{product.class_name}</Badge>}
                        </div>
                        
                        {product.description_long && (
                          <p className="text-sm text-muted-foreground">
                            {product.description_long}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pricing */}
                  {product.prices && product.prices.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Pricing</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {product.prices.map((price, index) => (
                            <div key={index} className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                List Price
                              </span>
                              <div className="text-right">
                                <span className="font-medium">€{price.start_price}</span>
                                {price.disc1 > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    -{price.disc1}% discount available
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Features */}
                  {product.features && product.features.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Specifications</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {product.features.map((feature, index) => (
                            <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-b-0">
                              <span className="text-sm font-medium">{feature.feature_name}</span>
                              <span className="text-sm text-muted-foreground">
                                {feature.fvalueC_desc || 
                                 (feature.fvalueN !== undefined ? `${feature.fvalueN}${feature.unit_abbrev ? ` ${feature.unit_abbrev}` : ''}` : '') ||
                                 (feature.fvalueB !== undefined ? (feature.fvalueB ? 'Yes' : 'No') : '')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Actions */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex gap-3">
                        <Button className="flex-1">
                          Add to Quote
                        </Button>
                        <Button variant="outline" size="icon">
                          <FaExternalLinkAlt className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {!product && !isLoading && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Product not found</p>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}