'use client'

import { useRouter, useParams } from 'next/navigation'
import { useDevSession } from '@/lib/use-dev-session'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { FaArrowLeft } from 'react-icons/fa'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { useTheme } from 'next-themes'

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
  const [mounted, setMounted] = useState(false)
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [logoError, setLogoError] = useState(false)

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

  // Determine template type for the product
  const templateType = product ? getTemplateType(product) : 'generic'

  if (!session && status !== 'loading') {
    return null
  }

  return (
    <ProtectedPageLayout
      headerContent={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <FaArrowLeft className="h-4 w-4" />
          Back to Products
        </Button>
      }
    >
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {(status === 'loading' || isLoading) ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Spinner size="lg" />
          </div>
        ) : !product ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Product not found</p>
              <Button
                onClick={() => router.back()}
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
    </ProtectedPageLayout>
  )
}