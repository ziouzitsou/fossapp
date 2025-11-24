'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { SupplierFilter } from '@/components/products/SupplierFilter'
import { RangeFilter, CategoricalFilter, BooleanFilter } from './FilterComponents'
import {
  getFilterDefinitionsAction,
  getFilterValuesAction,
  getFilterRangeAction,
  type FilterDefinition,
  type FilterGroup
} from '@/lib/filters/actions'

export interface FilterValues {
  supplier?: number | null
  [key: string]: any // range: {min, max}, categorical: string[], boolean: boolean
}

interface FilterPanelProps {
  taxonomyCode?: string
  values: FilterValues
  onChange: (values: FilterValues) => void
}

export function FilterPanel({
  taxonomyCode,
  values,
  onChange
}: FilterPanelProps) {
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([])
  const [filterOptions, setFilterOptions] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  // TEMPORARILY DISABLED: Load filter definitions
  // TODO: Fix infinite loop issue before re-enabling
  useEffect(() => {
    setLoading(false)
    // Disable ETIM filter loading for now
    // const groups = await getFilterDefinitionsAction(taxonomyCode)
    // setFilterGroups(groups)
  }, [taxonomyCode])

  // TEMPORARILY DISABLED: Load options for categorical filters
  // TODO: Fix infinite loop issue before re-enabling
  useEffect(() => {
    // Disabled to prevent infinite loop
  }, [filterGroups, taxonomyCode])

  const handleFilterChange = (filterKey: string, value: any) => {
    onChange({
      ...values,
      [filterKey]: value
    })
  }

  const handleClearAll = () => {
    onChange({})
  }

  const activeFilterCount = Object.keys(values).filter(
    key => values[key] !== undefined && values[key] !== null
  ).length

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading filters...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Filters</CardTitle>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-8 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear all ({activeFilterCount})
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {filterGroups.map((group, groupIndex) => (
          <div key={group.name}>
            {groupIndex > 0 && <Separator className="my-6" />}

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {group.name}
              </h3>

              <div className="space-y-4">
                {group.filters.map((filter) => {
                  // Special handling for supplier (custom component)
                  if (filter.filter_key === 'supplier') {
                    return (
                      <SupplierFilter
                        key={filter.filter_key}
                        selectedSupplierId={values.supplier}
                        onSupplierChange={(id) => handleFilterChange('supplier', id)}
                      />
                    )
                  }

                  // Render filter based on type
                  if (filter.filter_type === 'range') {
                    return (
                      <RangeFilter
                        key={filter.filter_key}
                        filter={filter}
                        value={values[filter.filter_key]}
                        onChange={(value) => handleFilterChange(filter.filter_key, value)}
                        actualRange={filterOptions[filter.filter_key]}
                      />
                    )
                  }

                  if (filter.filter_type === 'categorical') {
                    return (
                      <CategoricalFilter
                        key={filter.filter_key}
                        filter={filter}
                        value={values[filter.filter_key]}
                        onChange={(value) => handleFilterChange(filter.filter_key, value)}
                        availableOptions={filterOptions[filter.filter_key]}
                      />
                    )
                  }

                  if (filter.filter_type === 'boolean') {
                    return (
                      <BooleanFilter
                        key={filter.filter_key}
                        filter={filter}
                        value={values[filter.filter_key]}
                        onChange={(value) => handleFilterChange(filter.filter_key, value)}
                      />
                    )
                  }

                  return null
                })}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
