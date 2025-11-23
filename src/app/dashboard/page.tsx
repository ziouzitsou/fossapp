'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDevSession } from '@/lib/use-dev-session'
import Image from 'next/image'
import { FaBars, FaTimes } from 'react-icons/fa'
import { getNavigation } from '@/lib/navigation'
import { VersionDisplay } from '@/components/version-display'
import { UserDropdown } from '@/components/user-dropdown'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Package, Building2, Grid3x3, Calendar } from 'lucide-react'
import {
  getDashboardStatsAction,
  getSupplierStatsAction,
  getTopFamiliesAction,
  getActiveCatalogsAction,
  getMostActiveUsersAction,
  type DashboardStats,
  type SupplierStats,
  type FamilyStats,
  type CatalogInfo,
  type ActiveUser
} from '@/lib/actions'
import { MostActiveUsersCard } from '@/components/most-active-users-card'

export default function Dashboard() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({ totalProducts: 0, totalSuppliers: 0, totalFamilies: 0 })
  const [suppliers, setSuppliers] = useState<SupplierStats[]>([])
  const [catalogs, setCatalogs] = useState<CatalogInfo[]>([])
  const [topFamilies, setTopFamilies] = useState<FamilyStats[]>([])
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
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
      const [dashboardStats, supplierStats, catalogStats, familyStats, mostActiveUsers] = await Promise.all([
        getDashboardStatsAction(),
        getSupplierStatsAction(),
        getActiveCatalogsAction(),
        getTopFamiliesAction(10),
        getMostActiveUsersAction(5)
      ])

      setStats(dashboardStats)
      setSuppliers(supplierStats)
      setCatalogs(catalogStats)
      setTopFamilies(familyStats)
      setActiveUsers(mostActiveUsers)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  const navigation = getNavigation('/dashboard')

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
              {/* User menu */}
              <UserDropdown user={session.user} />
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
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

            {/* Active Catalogs */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Active Catalogs</CardTitle>
                <p className="text-sm text-muted-foreground">Currently available supplier catalogs</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {catalogs.map((catalog) => (
                    <div
                      key={`${catalog.supplier_name}-${catalog.catalog_name}-${catalog.generation_date}`}
                      className="p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        {/* Supplier Logo */}
                        {catalog.supplier_logo && (
                          <div className="relative w-16 h-16 flex-shrink-0">
                            <Image
                              src={catalog.supplier_logo}
                              alt={catalog.supplier_name}
                              fill
                              sizes="64px"
                              className="object-contain dark:hidden"
                            />
                            {catalog.supplier_logo_dark && (
                              <Image
                                src={catalog.supplier_logo_dark}
                                alt={catalog.supplier_name}
                                fill
                                sizes="64px"
                                className="object-contain hidden dark:block"
                              />
                            )}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          {/* Catalog Name & Supplier */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-base">{catalog.catalog_name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                {/* Country Flag */}
                                {catalog.country_flag && (
                                  <div className="relative w-5 h-4 flex-shrink-0">
                                    <Image
                                      src={catalog.country_flag}
                                      alt={catalog.country}
                                      fill
                                      sizes="20px"
                                      className="object-cover rounded-sm"
                                    />
                                  </div>
                                )}
                                <span className="text-sm text-muted-foreground">
                                  {catalog.supplier_name}
                                  {catalog.country && ` • ${catalog.country}`}
                                </span>
                              </div>
                            </div>
                            <Badge variant="secondary" className="ml-2 flex-shrink-0">
                              {catalog.product_count.toLocaleString()} products
                            </Badge>
                          </div>

                          {/* Catalog Date */}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              Generated: {new Date(catalog.generation_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Most Active Users */}
            <MostActiveUsersCard users={activeUsers} loading={loading} />

            {/* Top Product Families */}
            <Card className="mt-6">
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
