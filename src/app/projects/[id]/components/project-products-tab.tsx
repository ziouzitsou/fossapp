'use client'

/**
 * ProjectProductsTab - Products section of the project detail page
 *
 * Displays products grouped by area with quantity controls and totals.
 */

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@fossapp/ui'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@fossapp/ui'
import { Input } from '@fossapp/ui'
import { Plus, Minus, Trash2, ChevronDown, ChevronRight, Layers } from 'lucide-react'
import type { ProjectProduct } from '@fossapp/projects'
import { formatCurrency, getStatusBadge, calculateProductTotals, type ProductTotals } from './utils'

interface AreaGroup {
  area_code: string
  area_name: string
  products: ProjectProduct[]
  totals: ProductTotals
}

interface ProjectProductsTabProps {
  products: ProjectProduct[]
  currency: string
  updatingProducts: Set<string>
  onQuantityChange: (productId: string, newQuantity: number) => void
  onRemoveProduct: (productId: string) => void
}

export function ProjectProductsTab({
  products,
  currency,
  updatingProducts,
  onQuantityChange,
  onRemoveProduct,
}: ProjectProductsTabProps) {
  // Expanded areas state for collapsible sections
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(() => new Set(['all']))

  // Group products by area
  const areaGroups = groupProductsByArea(products)

  // Calculate overall totals
  const productsTotals = calculateProductTotals(products)

  const toggleAreaExpanded = (areaCode: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaCode)) {
        next.delete(areaCode)
      } else {
        next.add(areaCode)
      }
      return next
    })
  }

  const expandAllAreas = () => {
    setExpandedAreas(new Set(areaGroups.map(g => g.area_code)))
  }

  const collapseAllAreas = () => {
    setExpandedAreas(new Set())
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Project Products
            </CardTitle>
            <CardDescription>
              {products.length} products across {areaGroups.length} area{areaGroups.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          {areaGroups.length > 1 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAllAreas}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAllAreas}>
                Collapse All
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No products added yet</p>
        ) : (
          <div className="space-y-4">
            {areaGroups.map((group) => (
              <Collapsible
                key={group.area_code}
                open={expandedAreas.has(group.area_code)}
                onOpenChange={() => toggleAreaExpanded(group.area_code)}
              >
                <div className="border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        {expandedAreas.has(group.area_code) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {group.area_code}
                            </Badge>
                            <span className="font-medium">{group.area_name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {group.products.length} product{group.products.length !== 1 ? 's' : ''} • {group.totals.quantity} units
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-lg">
                          {formatCurrency(group.totals.grandTotal, currency)}
                        </div>
                        {group.totals.discountTotal > 0 && (
                          <p className="text-sm text-destructive">
                            -{formatCurrency(group.totals.discountTotal, currency)} discount
                          </p>
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px] text-center">#</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead className="text-center">Qty</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Discount</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.products.map((product, index) => (
                            <ProductRow
                              key={product.id}
                              product={product}
                              index={index}
                              currency={currency}
                              isUpdating={updatingProducts.has(product.id)}
                              onQuantityChange={onQuantityChange}
                              onRemove={onRemoveProduct}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}

            {/* Grand Total Summary */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Grand Total</p>
                    <p className="text-sm text-muted-foreground">
                      {products.length} products • {productsTotals.quantity} units
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {formatCurrency(productsTotals.grandTotal, currency)}
                    </p>
                    {productsTotals.discountTotal > 0 && (
                      <p className="text-sm text-destructive">
                        -{formatCurrency(productsTotals.discountTotal, currency)} total discount
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Helper: Group products by area
function groupProductsByArea(products: ProjectProduct[]): AreaGroup[] {
  const groups = new Map<string, { area_name: string; products: ProjectProduct[] }>()

  for (const product of products) {
    const areaCode = product.area_code || 'NO_AREA'
    const areaName = product.area_name || 'Unassigned'

    if (!groups.has(areaCode)) {
      groups.set(areaCode, { area_name: areaName, products: [] })
    }
    groups.get(areaCode)!.products.push(product)
  }

  return Array.from(groups.entries()).map(([area_code, { area_name, products }]) => ({
    area_code,
    area_name,
    products,
    totals: calculateProductTotals(products),
  }))
}

// Product row component
interface ProductRowProps {
  product: ProjectProduct
  index: number
  currency: string
  isUpdating: boolean
  onQuantityChange: (productId: string, newQuantity: number) => void
  onRemove: (productId: string) => void
}

function ProductRow({
  product,
  index,
  currency,
  isUpdating,
  onQuantityChange,
  onRemove,
}: ProductRowProps) {
  return (
    <TableRow className={isUpdating ? 'opacity-50' : ''}>
      <TableCell className="text-center text-muted-foreground font-medium">
        {index + 1}
      </TableCell>
      <TableCell>
        <Link
          href={`/products/${product.product_id}`}
          className="hover:underline"
        >
          <div className="font-medium">{product.foss_pid}</div>
          <div className="text-sm text-muted-foreground">{product.description_short}</div>
        </Link>
      </TableCell>
      <TableCell>{product.room_location || '-'}</TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={isUpdating || product.quantity <= 1}
            onClick={() => onQuantityChange(product.id, product.quantity - 1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            key={`${product.id}-${product.quantity}`}
            type="number"
            min={1}
            defaultValue={product.quantity}
            onBlur={(e) => {
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val) && val >= 1 && val !== product.quantity) {
                onQuantityChange(product.id, val)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
            }}
            className="w-14 h-7 text-center px-1"
            disabled={isUpdating}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={isUpdating}
            onClick={() => onQuantityChange(product.id, product.quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-right">{formatCurrency(product.unit_price, currency)}</TableCell>
      <TableCell className="text-right">{product.discount_percent || 0}%</TableCell>
      <TableCell className="text-right font-medium">{formatCurrency(product.total_price, currency)}</TableCell>
      <TableCell>{getStatusBadge(product.status)}</TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          disabled={isUpdating}
          onClick={() => onRemove(product.id)}
          title="Remove from project"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}
