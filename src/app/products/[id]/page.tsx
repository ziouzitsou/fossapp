'use client'

import { useRouter, useParams } from 'next/navigation'
import { useDevSession } from '@/lib/use-dev-session'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { FaSignOutAlt, FaChevronDown, FaBars, FaTimes, FaArrowLeft } from 'react-icons/fa'
import { MdDashboard, MdWork } from 'react-icons/md'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// Import our new template system
import { ProductInfo } from '@/types/product'
import { getTemplateType } from '@/lib/utils/product-classification'
import { ProductTypeBadge } from '@/components/products/header/ProductTypeBadge'
import { ProductLayout } from '@/components/products/layouts/ProductLayout'

export default function ProductDetailPage() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const params = useParams()
  const { resolvedTheme } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [logoError, setLogoError] = useState(false)
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

  const handleLogout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/')
  }

  // Determine template type for the product
  const templateType = product ? getTemplateType(product) : 'generic'

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

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-card border-r
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:inset-0
        `}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <Image
                src="/icon-192x192.png"
                alt="Company Logo"
                width={40}
                height={40}
                className="rounded"
              />
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-muted-foreground hover:text-foreground"
              >
                <FaTimes className="h-6 w-6" />
              </button>
            </div>
          </div>

          <nav className="flex-1 p-6 space-y-2">
            <div className="space-y-1">
              <a
                href="/dashboard"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <MdDashboard className="h-5 w-5" />
                <span>Projects</span>
              </a>
              <a
                href="/products"
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent text-accent-foreground"
              >
                <MdWork className="h-5 w-5" />
                <span>Products</span>
              </a>
            </div>
          </nav>

          <div className="p-6 border-t">
            <div className="text-xs text-muted-foreground">v1.2.1-dev</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b bg-background">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-muted-foreground hover:text-foreground"
              >
                <FaBars className="h-6 w-6" />
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/products')}
                className="flex items-center gap-2"
              >
                <FaArrowLeft className="h-4 w-4" />
                Back to Products
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />

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
                  <div className="absolute right-0 mt-2 w-48 bg-popover rounded-lg shadow-lg border">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-destructive hover:bg-accent rounded-lg transition-colors"
                    >
                      <FaSignOutAlt className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            {!product ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Product not found</p>
                  <Button
                    onClick={() => router.push('/products')}
                    className="mt-4"
                  >
                    Back to Products
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Product Header with Type Badge */}
                <div className="mb-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">
                        {product.description_short}
                      </h1>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{product.supplier_name}</span>
                        <span>•</span>
                        <span>Model: {product.foss_pid}</span>
                        {product.manufacturer_pid && (
                          <>
                            <span>•</span>
                            <span>MFR: {product.manufacturer_pid}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <ProductTypeBadge
                        templateType={templateType}
                        classId={product.class}
                      />
                      {mounted && !logoError && (product.supplier_logo || product.supplier_logo_dark) && (() => {
                        const logoUrl = resolvedTheme === 'dark' && product.supplier_logo_dark
                          ? product.supplier_logo_dark
                          : product.supplier_logo
                        return logoUrl ? (
                          <Image
                            src={logoUrl}
                            alt={product.supplier_name}
                            width={80}
                            height={40}
                            style={{ height: 'auto' }}
                            className="object-contain"
                            onError={() => setLogoError(true)}
                          />
                        ) : null
                      })()}
                    </div>
                  </div>

                  {/* ETIM Classification Info */}
                  {product.class_name && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {product.group_name}
                      </Badge>
                      <Badge variant="secondary">
                        {product.class_name}
                      </Badge>
                      {product.family && (
                        <Badge variant="outline">
                          Family: {product.family}
                        </Badge>
                      )}
                      {product.subfamily && (
                        <Badge variant="outline">
                          {product.subfamily}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Smart Template Layout */}
                <ProductLayout
                  product={product}
                  templateType={templateType}
                />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}