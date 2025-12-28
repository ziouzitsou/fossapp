/**
 * Project Page Utilities
 *
 * Shared helper functions for project detail page components.
 */

import { Badge } from '@fossapp/ui'

/**
 * Format a date string for display
 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('el-GR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Format a currency value for display
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'EUR'
): string {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: currency || 'EUR'
  }).format(amount)
}

/**
 * Get a colored badge for a status value
 */
export function getStatusBadge(status: string): React.ReactNode {
  const statusConfig: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'secondary',
    active: 'default',
    in_progress: 'default',
    specified: 'default',
    quoted: 'secondary',
    ordered: 'default',
    delivered: 'default',
    installed: 'default',
    completed: 'default',
    on_hold: 'outline',
    cancelled: 'destructive',
    archived: 'outline',
    pending: 'secondary',
    not_started: 'outline',
  }

  return (
    <Badge variant={statusConfig[status] || 'secondary'} className="capitalize">
      {status?.replace(/_/g, ' ') || 'Unknown'}
    </Badge>
  )
}

/**
 * Calculate product totals including discounts
 */
export interface ProductTotals {
  subtotal: number
  discountTotal: number
  grandTotal: number
  quantity: number
}

export function calculateProductTotals(products: Array<{
  quantity: number
  unit_price?: number | null
  discount_percent?: number | null
  total_price?: number | null
}>): ProductTotals {
  return products.reduce<ProductTotals>(
    (acc, p) => {
      const unitPrice = p.unit_price ?? 0
      const quantity = p.quantity
      const discountPercent = p.discount_percent ?? 0
      const subtotal = unitPrice * quantity
      const discountAmount = subtotal * (discountPercent / 100)

      return {
        subtotal: acc.subtotal + subtotal,
        discountTotal: acc.discountTotal + discountAmount,
        grandTotal: acc.grandTotal + (p.total_price ?? subtotal - discountAmount),
        quantity: acc.quantity + quantity,
      }
    },
    { subtotal: 0, discountTotal: 0, grandTotal: 0, quantity: 0 }
  )
}
