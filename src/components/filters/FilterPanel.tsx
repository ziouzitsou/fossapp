'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { X } from 'lucide-react'
import { SupplierFilter } from '@/components/products/SupplierFilter'
import {
  BooleanFilter,
  MultiSelectFilter,
  RangeFilter,
  FilterCategory,
  type FilterFacet
} from './index'
import {
  getFilterDefinitionsAction,
  type FilterGroup
} from '@/lib/filters/actions'

export interface FilterValues {
  supplier?: number | null
  [key: string]: any // range: {min, max}, multi-select: string[], boolean: boolean
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
  const [filterFacets, setFilterFacets] = useState<FilterFacet[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['Source', 'Electricals', 'Design', 'Light', 'Location', 'Options'])
  )
  const [loading, setLoading] = useState(true)

  // Load filters when taxonomy or filter values change
  // FIX: Use individual filter values as dependencies to prevent infinite loop
  useEffect(() => {
    loadFilters()
  }, [
    taxonomyCode,
    values.supplier,
    values.indoor,
    values.outdoor,
    values.submersible,
    values.trimless,
    values.cut_shape_round,
    values.cut_shape_rectangular
  ])

  const loadFilters = async () => {
    try {
      setLoading(true)

      // Load filter definitions grouped by 'group' field
      const groups = await getFilterDefinitionsAction(taxonomyCode)
      setFilterGroups(groups)

      // Load dynamic facets with product counts
      const facetResponse = await fetch('/api/filters/facets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxonomyCode,
          supplier: values.supplier,
          indoor: values.indoor,
          outdoor: values.outdoor,
          submersible: values.submersible,
          trimless: values.trimless,
          cut_shape_round: values.cut_shape_round,
          cut_shape_rectangular: values.cut_shape_rectangular
        })
      })

      if (facetResponse.ok) {
        const facets = await facetResponse.json()
        setFilterFacets(facets)
      } else {
        console.error('Failed to load facets:', await facetResponse.text())
        setFilterFacets([])
      }

    } catch (error) {
      console.error('Error loading filters:', error)
      setFilterGroups([])
      setFilterFacets([])
    } finally {
      setLoading(false)
    }
  }

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupName)) {
        newSet.delete(groupName)
      } else {
        newSet.add(groupName)
      }
      return newSet
    })
  }

  const handleFilterChange = (filterKey: string, value: any) => {
    onChange({
      ...values,
      [filterKey]: value
    })
  }

  const clearFilter = (filterKey: string) => {
    const newValues = { ...values }
    delete newValues[filterKey]
    onChange(newValues)
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
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Simulate 6 filter groups */}
          {Array.from({ length: 6 }).map((_, groupIdx) => (
            <div key={groupIdx} className="space-y-4">
              {groupIdx > 0 && <Separator className="my-6" />}
              {/* Group header */}
              <Skeleton className="h-5 w-32" />
              {/* Simulate 2-3 filters per group */}
              {Array.from({ length: Math.floor(Math.random() * 2) + 2 }).map((_, filterIdx) => (
                <div key={filterIdx} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ))}
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

            <FilterCategory
              label={group.name}
              isExpanded={expandedGroups.has(group.name)}
              onToggle={() => toggleGroup(group.name)}
            >
              <div className="space-y-4">
                {group.filters.map((filter) => {
                  // Get facets for this filter
                  const facets = filterFacets.filter(f => f.filter_key === filter.filter_key)

                  // Special handling for supplier (custom component)
                  if (filter.filter_key === 'supplier') {
                    return (
                      <SupplierFilter
                        key={filter.filter_key}
                        selectedSupplierId={values.supplier}
                        onSupplierChange={(id) => handleFilterChange('supplier', id)}
                        taxonomyCode={taxonomyCode}
                      />
                    )
                  }

                  // Render BooleanFilter
                  if (filter.filter_type === 'boolean') {
                    return (
                      <BooleanFilter
                        key={filter.filter_key}
                        filterKey={filter.filter_key}
                        label={filter.label}
                        etimFeatureType={filter.etim_feature_id}
                        value={values[filter.filter_key] ?? null}
                        onChange={(value) => handleFilterChange(filter.filter_key, value)}
                        facets={facets}
                        showCount={true}
                        onClear={() => clearFilter(filter.filter_key)}
                      />
                    )
                  }

                  // Render MultiSelectFilter (for categorical)
                  if (filter.filter_type === 'categorical') {
                    return (
                      <MultiSelectFilter
                        key={filter.filter_key}
                        filterKey={filter.filter_key}
                        label={filter.label}
                        etimFeatureType={filter.etim_feature_id}
                        values={values[filter.filter_key] || []}
                        onChange={(vals) => handleFilterChange(filter.filter_key, vals)}
                        facets={facets}
                        options={{
                          showCount: true,
                          maxHeight: '16rem'
                        }}
                        onClear={() => clearFilter(filter.filter_key)}
                      />
                    )
                  }

                  // Render RangeFilter
                  if (filter.filter_type === 'range') {
                    // Define presets for specific filters
                    const presets = filter.filter_key === 'cct' ? [
                      { label: 'Warm White', min: 2700, max: 3000, description: 'Cozy' },
                      { label: 'Neutral White', min: 3500, max: 4500, description: 'Balanced' },
                      { label: 'Cool White', min: 5000, max: 6500, description: 'Energizing' }
                    ] : filter.filter_key === 'lumens_output' ? [
                      { label: 'Low', min: 0, max: 500, description: 'Ambient' },
                      { label: 'Medium', min: 500, max: 2000, description: 'Task' },
                      { label: 'High', min: 2000, max: 50000, description: 'High output' }
                    ] : []

                    return (
                      <RangeFilter
                        key={filter.filter_key}
                        filterKey={filter.filter_key}
                        label={filter.label}
                        etimFeatureType={filter.etim_feature_id}
                        value={values[filter.filter_key] || {}}
                        onChange={(value) => handleFilterChange(filter.filter_key, value)}
                        unit={filter.ui_config?.unit}
                        minBound={filter.ui_config?.min}
                        maxBound={filter.ui_config?.max}
                        step={filter.ui_config?.step || 1}
                        presets={presets}
                        facets={facets}
                        onClear={() => clearFilter(filter.filter_key)}
                      />
                    )
                  }

                  return null
                })}
              </div>
            </FilterCategory>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
