'use client'

import { useState, useEffect } from 'react'
import { Building2, Check } from 'lucide-react'
import { getSuppliersWithTaxonomyCountsAction, type Supplier } from '@/lib/actions'
import { cn } from '@fossapp/ui'
import { useTheme } from 'next-themes'

interface SupplierFilterProps {
  selectedSupplierId?: number | null
  onSupplierChange?: (supplierId: number | null) => void
  taxonomyCode?: string
}

export function SupplierFilter({
  selectedSupplierId = null,
  onSupplierChange,
  taxonomyCode
}: SupplierFilterProps) {
  const [selected, setSelected] = useState<number | null>(selectedSupplierId)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()

  // Fetch suppliers whenever taxonomy changes
  useEffect(() => {
    async function fetchSuppliers() {
      try {
        setLoading(true)
        const data = await getSuppliersWithTaxonomyCountsAction(taxonomyCode)
        setSuppliers(data)
      } catch (error) {
        console.error('Error fetching suppliers:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSuppliers()
  }, [taxonomyCode])

  const handleSelect = (supplierId: number | null) => {
    setSelected(supplierId)
    onSupplierChange?.(supplierId)
  }

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-4 w-4" />
          <span>Supplier</span>
        </div>
        <div className="text-sm text-muted-foreground">Loading suppliers...</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <Building2 className="h-4 w-4" />
        <span>Supplier</span>
      </div>

      {/* All Suppliers Option (Default) */}
      <button
        onClick={() => handleSelect(null)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 rounded-md border transition-all',
          selected === null
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border hover:border-primary/50 hover:bg-muted/50 hover:scale-[1.02]'
        )}
      >
        <span className="font-medium">All Suppliers</span>
        {selected === null && <Check className="h-4 w-4" />}
      </button>

      {/* Supplier List (Scrollable) */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {suppliers.map((supplier) => {
          const isSelected = selected === supplier.id
          const logoUrl = theme === 'dark' ? supplier.logo_dark : supplier.logo

          return (
            <button
              key={supplier.id}
              onClick={() => handleSelect(supplier.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md border transition-all',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50 hover:scale-[1.02]'
              )}
            >
              {/* Supplier Logo */}
              {logoUrl && (
                <div className="flex-shrink-0 w-12 h-8 flex items-center justify-center">
                  <img
                    src={logoUrl}
                    alt={supplier.supplier_name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}

              {/* Supplier Info */}
              <div className="flex-1 flex flex-col items-start min-w-0">
                <span className={cn(
                  'font-medium text-sm truncate w-full text-left',
                  isSelected && 'text-primary'
                )}>
                  {supplier.supplier_name}
                </span>
                {supplier.country && (
                  <span className="text-xs text-muted-foreground">
                    {supplier.country}
                  </span>
                )}
              </div>

              {/* Product Count */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatCount(supplier.product_count)}
                </span>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground">
        Filter products by manufacturer or brand
      </p>
    </div>
  )
}
