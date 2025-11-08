'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDevSession } from '@/lib/use-dev-session'
import Image from 'next/image'
import { FaSignOutAlt, FaChevronDown, FaBars, FaTimes } from 'react-icons/fa'
import { MdDashboard, MdWork } from 'react-icons/md'
import { ThemeToggle } from '@/components/theme-toggle'
import { VersionDisplay } from '@/components/version-display'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Database, Building2, Grid3x3 } from 'lucide-react'
import {
  getDashboardStatsAction,
  getSupplierStatsAction,
  getTopFamiliesAction,
  type DashboardStats,
  type SupplierStats,
  type FamilyStats
} from '@/lib/actions'

export default function Dashboard() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({ totalProducts: 0, totalSuppliers: 0, totalFamilies: 0 })
  const [suppliers, setSuppliers] = useState<SupplierStats[]>([])
  const [topFamilies, setTopFamilies] = useState<FamilyStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      loadDashboardData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [dashboardStats, supplierStats, familyStats] = await Promise.all([
        getDashboardStatsAction(),
        getSupplierStatsAction(),
        getTopFamiliesAction(10)
      ])

      setStats(dashboardStats)
      setSuppliers(supplierStats)
      setTopFamilies(familyStats)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
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
    { name: 'Dashboard', icon: MdDashboard, href: '/dashboard', current: true },
    { name: 'Products', icon: MdWork, href: '/products', current: false },
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
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-2">Overview of your lighting product database</p>
            </div>

            {/* Main Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalProducts.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lighting products in database
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Catalogs</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalSuppliers}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supplier catalogs
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Product Families</CardTitle>
                  <Grid3x3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalFamilies}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Unique product families
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{suppliers.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active suppliers
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Supplier Catalogs Grid */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Supplier Catalogs</CardTitle>
                <p className="text-sm text-muted-foreground">Products per supplier catalog</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {suppliers.map((supplier) => (
                    <div
                      key={supplier.supplier_name}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {supplier.supplier_logo && (
                          <div className="relative w-12 h-12 flex-shrink-0">
                            <Image
                              src={supplier.supplier_logo}
                              alt={supplier.supplier_name}
                              fill
                              sizes="48px"
                              className="object-contain dark:hidden"
                            />
                            {supplier.supplier_logo_dark && (
                              <Image
                                src={supplier.supplier_logo_dark}
                                alt={supplier.supplier_name}
                                fill
                                sizes="48px"
                                className="object-contain hidden dark:block"
                              />
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{supplier.supplier_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {supplier.product_count.toLocaleString()} products
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {supplier.product_count.toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Vendor Logos Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Vendor Logos</CardTitle>
                <p className="text-sm text-muted-foreground">All suppliers in the database</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-6 items-center justify-start">
                  {suppliers
                    .filter(s => s.supplier_logo)
                    .map((supplier) => (
                      <div
                        key={supplier.supplier_name}
                        className="relative w-24 h-24 p-2 border rounded-lg hover:shadow-md transition-shadow"
                        title={supplier.supplier_name}
                      >
                        <Image
                          src={supplier.supplier_logo!}
                          alt={supplier.supplier_name}
                          fill
                          sizes="96px"
                          className="object-contain p-2 dark:hidden"
                        />
                        {supplier.supplier_logo_dark && (
                          <Image
                            src={supplier.supplier_logo_dark}
                            alt={supplier.supplier_name}
                            fill
                            sizes="96px"
                            className="object-contain p-2 hidden dark:block"
                          />
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Product Families */}
            <Card>
              <CardHeader>
                <CardTitle>Top Product Families</CardTitle>
                <p className="text-sm text-muted-foreground">Most popular product categories</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topFamilies.map((family, index) => (
                    <div
                      key={family.family}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium text-sm">
                          {index + 1}
                        </div>
                        <span className="font-medium">{family.family}</span>
                      </div>
                      <Badge variant="outline">
                        {family.product_count.toLocaleString()} products
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
