'use client'

import { useRouter, useParams } from 'next/navigation'
import { useDevSession } from '@/lib/use-dev-session'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { FaArrowLeft, FaHeart, FaRegHeart, FaPlus, FaFolder, FaCheck } from 'react-icons/fa'
import { MdLayers } from 'react-icons/md'
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
import { useActiveProject } from '@/lib/active-project-context'
import { addProductToProjectAction } from '@/lib/actions'
import { useBucket } from '@/components/tiles/bucket-context'

export default function ProductDetailPage() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const params = useParams()
  const { resolvedTheme } = useTheme()
  const { activeProject } = useActiveProject()
  const { addToBucket, isInBucket } = useBucket()
  const [mounted, setMounted] = useState(false)
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [logoError, setLogoError] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isAddingToProject, setIsAddingToProject] = useState(false)
  const [addedMessage, setAddedMessage] = useState<string | null>(null)
  const [bucketMessage, setBucketMessage] = useState<string | null>(null)

  const handleFavoriteClick = () => {
    setIsFavorite(!isFavorite)
    // TODO: Implement favorite persistence
  }

  const handleAddToBucket = () => {
    if (!product) return

    if (isInBucket(product.product_id)) {
      setBucketMessage('Already in bucket')
      setTimeout(() => setBucketMessage(null), 2000)
      return
    }

    addToBucket(product)
    setBucketMessage('Added to bucket')
    setTimeout(() => setBucketMessage(null), 2000)
  }

  const handleAddToProject = async () => {
    if (!activeProject || !product) return

    setIsAddingToProject(true)
    setAddedMessage(null)

    try {
      const result = await addProductToProjectAction({
        project_id: activeProject.id,
        product_id: product.product_id,
      })

      if (result.success) {
        setAddedMessage(`Added to ${activeProject.project_code}`)
        setTimeout(() => setAddedMessage(null), 3000)
      } else {
        setAddedMessage(result.error || 'Failed to add')
        setTimeout(() => setAddedMessage(null), 3000)
      }
    } catch (error) {
      console.error('Error adding to project:', error)
      setAddedMessage('Failed to add')
      setTimeout(() => setAddedMessage(null), 3000)
    } finally {
      setIsAddingToProject(false)
    }
  }

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

            {/* Product Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {/* Favorite Button */}
              <Button
                variant={isFavorite ? 'default' : 'outline'}
                size="sm"
                onClick={handleFavoriteClick}
                className="flex items-center gap-2"
              >
                {isFavorite ? (
                  <FaHeart className="h-4 w-4 text-red-500" />
                ) : (
                  <FaRegHeart className="h-4 w-4" />
                )}
                {isFavorite ? 'Favorited' : 'Favorite'}
              </Button>

              {/* Add to Project Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddToProject}
                disabled={!activeProject || isAddingToProject}
                className="flex items-center gap-2"
                title={activeProject ? `Add to ${activeProject.name}` : 'No active project - activate one from Projects page'}
              >
                {isAddingToProject ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <FaPlus className="h-3 w-3" />
                    <FaFolder className="h-4 w-4" />
                  </>
                )}
                {activeProject ? (
                  <span>Add to {activeProject.project_code}</span>
                ) : (
                  <span className="text-muted-foreground">No active project</span>
                )}
              </Button>

              {/* Add to Bucket Button (Tiles) */}
              <Button
                variant={product && isInBucket(product.product_id) ? 'secondary' : 'outline'}
                size="sm"
                onClick={handleAddToBucket}
                className="flex items-center gap-2"
                title="Add to Tiles bucket for DWG generation"
              >
                {product && isInBucket(product.product_id) ? (
                  <FaCheck className="h-4 w-4 text-green-600" />
                ) : (
                  <>
                    <FaPlus className="h-3 w-3" />
                    <MdLayers className="h-4 w-4" />
                  </>
                )}
                <span>{product && isInBucket(product.product_id) ? 'In Bucket' : 'Add to Bucket'}</span>
              </Button>

              {/* Success/Error Messages */}
              {addedMessage && (
                <span className={`text-sm ${addedMessage.includes('Added') ? 'text-green-600' : 'text-red-600'}`}>
                  {addedMessage}
                </span>
              )}
              {bucketMessage && (
                <span className={`text-sm ${bucketMessage.includes('Added') ? 'text-green-600' : 'text-amber-600'}`}>
                  {bucketMessage}
                </span>
              )}
            </div>
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