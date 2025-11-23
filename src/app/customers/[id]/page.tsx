'use client'

import { useRouter, useParams } from 'next/navigation'
import { useDevSession } from '@/lib/use-dev-session'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { FaBars, FaTimes, FaArrowLeft, FaEnvelope, FaPhone, FaMobileAlt, FaFax, FaGlobe, FaMapMarkerAlt, FaBuilding, FaIndustry, FaHashtag } from 'react-icons/fa'
import { getNavigation } from '@/lib/navigation'
import { VersionDisplay } from '@/components/version-display'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserDropdown } from '@/components/user-dropdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { getCustomerByIdAction, type CustomerDetail } from '@/lib/actions'

export default function CustomerDetailPage() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const params = useParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (params?.id) {
      loadCustomer(params.id as string)
    }
  }, [params?.id])

  const loadCustomer = async (customerId: string) => {
    setIsLoading(true)
    try {
      const data = await getCustomerByIdAction(customerId)
      setCustomer(data)
    } catch (error) {
      console.error('Error loading customer:', error)
      setCustomer(null)
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  const navigation = getNavigation('/customers')

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
                onClick={() => router.push('/customers')}
                className="flex items-center gap-2"
              >
                <FaArrowLeft className="h-4 w-4" />
                Back to Customers
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserDropdown user={session.user} />
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            {!customer ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Customer not found</p>
                  <Button
                    onClick={() => router.push('/customers')}
                    className="mt-4"
                  >
                    Back to Customers
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Customer Header */}
                <div className="mb-6">
                  <h1 className="text-3xl font-bold mb-2">{customer.name}</h1>
                  {customer.name_en && (
                    <p className="text-lg text-muted-foreground mb-2">{customer.name_en}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">
                      <FaHashtag className="h-3 w-3 mr-1" />
                      {customer.customer_code}
                    </Badge>
                    {customer.country && (
                      <Badge variant="outline">{customer.country}</Badge>
                    )}
                    {customer.size_category && (
                      <Badge variant="outline">{customer.size_category}</Badge>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Contact Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {customer.email && (
                        <div className="flex items-center gap-3">
                          <FaEnvelope className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${customer.email}`} className="text-sm hover:underline">
                            {customer.email}
                          </a>
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-center gap-3">
                          <FaPhone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${customer.phone}`} className="text-sm hover:underline">
                            {customer.phone}
                          </a>
                        </div>
                      )}
                      {customer.mobile && (
                        <div className="flex items-center gap-3">
                          <FaMobileAlt className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${customer.mobile}`} className="text-sm hover:underline">
                            {customer.mobile}
                          </a>
                        </div>
                      )}
                      {customer.fax && (
                        <div className="flex items-center gap-3">
                          <FaFax className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{customer.fax}</span>
                        </div>
                      )}
                      {customer.website && (
                        <div className="flex items-center gap-3">
                          <FaGlobe className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={customer.website.startsWith('http') ? customer.website : `https://${customer.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm hover:underline"
                          >
                            {customer.website}
                          </a>
                        </div>
                      )}
                      {!customer.email && !customer.phone && !customer.mobile && !customer.fax && !customer.website && (
                        <p className="text-sm text-muted-foreground">No contact information available</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Address Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Address</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {customer.street_address && (
                        <div className="flex items-start gap-3">
                          <FaMapMarkerAlt className="h-4 w-4 text-muted-foreground mt-1" />
                          <div className="text-sm">
                            <p>{customer.street_address}</p>
                            <p>
                              {customer.postal_code && `${customer.postal_code}, `}
                              {customer.city}
                            </p>
                            {customer.region && <p>{customer.region}</p>}
                            {customer.prefecture && <p>{customer.prefecture}</p>}
                            {customer.country && <p>{customer.country}</p>}
                          </div>
                        </div>
                      )}
                      {!customer.street_address && customer.city && (
                        <div className="flex items-center gap-3">
                          <FaMapMarkerAlt className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {customer.postal_code && `${customer.postal_code}, `}
                            {customer.city}
                            {customer.region && `, ${customer.region}`}
                            {customer.prefecture && `, ${customer.prefecture}`}
                            {customer.country && `, ${customer.country}`}
                          </span>
                        </div>
                      )}
                      {customer.latitude && customer.longitude && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Coordinates: {customer.latitude}, {customer.longitude}
                        </div>
                      )}
                      {!customer.street_address && !customer.city && (
                        <p className="text-sm text-muted-foreground">No address information available</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Business Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Business Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {customer.industry && (
                        <div className="flex items-center gap-3">
                          <FaIndustry className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{customer.industry}</span>
                        </div>
                      )}
                      {customer.company_type && (
                        <div className="flex items-center gap-3">
                          <FaBuilding className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{customer.company_type}</span>
                        </div>
                      )}
                      {customer.size_category && (
                        <div className="flex items-center gap-3">
                          <FaBuilding className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm capitalize">Size: {customer.size_category}</span>
                        </div>
                      )}
                      {customer.tax_id && (
                        <div className="flex items-center gap-3">
                          <FaHashtag className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Tax ID: {customer.tax_id}</span>
                        </div>
                      )}
                      {!customer.industry && !customer.company_type && !customer.size_category && !customer.tax_id && (
                        <p className="text-sm text-muted-foreground">No business information available</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Additional Information */}
                  {customer.notes && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Metadata */}
                <Card>
                  <CardHeader>
                    <CardTitle>Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {customer.data_source && (
                      <div>
                        <span className="font-medium">Data Source:</span> {customer.data_source}
                      </div>
                    )}
                    {customer.created_at && (
                      <div>
                        <span className="font-medium">Created:</span>{' '}
                        {new Date(customer.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    )}
                    {customer.updated_at && (
                      <div>
                        <span className="font-medium">Last Updated:</span>{' '}
                        {new Date(customer.updated_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
