'use client'

import { useRouter, useParams } from 'next/navigation'
import { useDevSession } from '@/lib/use-dev-session'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { FaSignOutAlt, FaChevronDown, FaBars, FaTimes, FaArrowLeft , FaSun, FaMoon, FaDesktop, FaCheck} from 'react-icons/fa'
import { getNavigation } from '@/lib/navigation'
import { VersionDisplay } from '@/components/version-display'
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
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
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

  // Navigation menu items
  const navigation = getNavigation('/products')

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
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-popover rounded-md shadow-lg py-1 z-50 border">
                      {session.user?.name && (
                        <div className="px-4 py-2 border-b">
                          <p className="text-sm font-medium text-popover-foreground">{session.user?.name}</p>
                          <p className="text-sm text-muted-foreground">{session.user?.email}</p>
                        </div>
                      )}

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
                        onClick={handleLogout}
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