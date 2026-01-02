/**
 * Filter Panel - Dynamic product filtering UI based on selected taxonomy
 *
 * Renders a collapsible filter panel that adapts based on the selected product
 * category (taxonomy). When no category is selected, only the supplier filter
 * is shown. When a category is selected, loads additional filters from the
 * database (CCT, CRI, IP rating, beam angle, etc.).
 *
 * @remarks
 * **Filter Types Supported**:
 * - `boolean`: Yes/No/Either toggle (e.g., Indoor, Outdoor)
 * - `categorical`: Multi-select checkboxes (e.g., IP Rating, Light Source)
 * - `range`: Min/max numeric inputs with optional presets (e.g., CCT, Lumens)
 *
 * **Data Flow**:
 * 1. Taxonomy selected → Load filter definitions from DB
 * 2. Fetch facets (counts) based on current filter state
 * 3. User changes filter → `onChange` callback updates parent state
 * 4. Parent triggers new search with updated filters
 *
 * @see {@link getFilterDefinitionsAction} for filter definition loading
 * @see {@link BooleanFilter} {@link MultiSelectFilter} {@link RangeFilter} for filter components
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { logEventClient } from '@fossapp/core/logging/client'
import { Card, CardContent, CardHeader, CardTitle } from '@fossapp/ui'
import { Separator } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Skeleton } from '@fossapp/ui'
import { X, Filter } from 'lucide-react'
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

/**
 * Range filter value - both min and max are optional during editing.
 * Only applied to query when at least one bound is set.
 */
export type RangeValue = { min?: number; max?: number }

/**
 * Union of all possible filter value types.
 * The actual type depends on the filter's `filter_type` in the definition.
 */
export type FilterValue = RangeValue | string[] | string | boolean | number | null

/**
 * Interface for all filter values, combining typed known filters with dynamic support.
 *
 * @remarks
 * Known properties provide type safety for common filters.
 * The index signature allows any additional filters loaded from the database.
 */
export interface FilterValues {
  /** Selected supplier ID from the supplier dropdown */
  supplier?: number | null

  // Boolean filters (installation environment)
  indoor?: boolean
  outdoor?: boolean
  submersible?: boolean
  trimless?: boolean
  cut_shape_round?: boolean
  cut_shape_rectangular?: boolean

  // Range filters (lighting specifications)
  /** Correlated Color Temperature in Kelvin (e.g., 2700-6500) */
  cct?: RangeValue
  /** Color Rendering Index (0-100) */
  cri?: RangeValue
  /** Light output in lumens */
  lumens_output?: RangeValue
  /** Operating voltage */
  voltage?: RangeValue
  /** Beam angle in degrees */
  beam_angle?: RangeValue

  // Multi-select filters
  /** IP (Ingress Protection) rating codes */
  ip?: string[]
  /** Finish/housing colors */
  finishing_colour?: string[]
  /** Light source type (LED, etc.) */
  light_source?: string[]
  /** Light distribution pattern */
  light_distribution?: string[]
  /** Beam angle classification */
  beam_angle_type?: string[]
  /** Dimming capabilities */
  dimmable?: string[]
  /** ETIM class codes */
  class?: string[]

  /** Index signature for dynamic filters loaded from database */
  [key: string]: FilterValue | RangeValue | undefined
}

/**
 * Props for the FilterPanel component.
 */
interface FilterPanelProps {
  /** Current taxonomy code (e.g., "EC001234") - determines which filters to show */
  taxonomyCode?: string
  /** Current filter values - controlled component pattern */
  values: FilterValues
  /** Called when any filter value changes */
  onChange: (values: FilterValues) => void
}

/**
 * Renders the filter panel with taxonomy-specific filters.
 *
 * @remarks
 * Has three render modes:
 * 1. **Loading**: Shows skeleton while fetching filter definitions
 * 2. **No taxonomy**: Shows only supplier filter with guidance message
 * 3. **Full filters**: Shows all applicable filters grouped by category
 */
export function FilterPanel({
  taxonomyCode,
  values,
  onChange
}: FilterPanelProps) {
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([])
  const [filterFacets, setFilterFacets] = useState<FilterFacet[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set() // Start collapsed
  )
  const [loading, setLoading] = useState(false)

  // Load filters when taxonomy or filter values change
  useEffect(() => {
    // No taxonomy - just show supplier filter (no need to load filter definitions)
    if (!taxonomyCode) {
      setFilterGroups([])
      setFilterFacets([])
      setLoading(false)
      return
    }

    // Track if this effect is still current (for cleanup)
    let isCurrent = true

    const loadFilters = async () => {
      setLoading(true)

      try {
        // Load filter definitions grouped by 'group' field
        const groups = await getFilterDefinitionsAction(taxonomyCode)

        // Check if effect was cleaned up
        if (!isCurrent) return

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

        // Check if effect was cleaned up
        if (!isCurrent) return

        if (facetResponse.ok) {
          const facets = await facetResponse.json()
          setFilterFacets(facets)
        } else {
          console.error('Failed to load facets:', await facetResponse.text())
          setFilterFacets([])
        }
      } catch (error) {
        if (!isCurrent) return
        console.error('Error loading filters:', error)
        setFilterGroups([])
        setFilterFacets([])
      } finally {
        if (isCurrent) {
          setLoading(false)
        }
      }
    }

    loadFilters()

    // Cleanup function - marks this effect as stale
    return () => {
      isCurrent = false
    }
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

  const handleFilterChange = useCallback((filterKey: string, value: FilterValue) => {
    onChange({
      ...values,
      [filterKey]: value
    })
    logEventClient('search_filter_applied', {
      filter_key: filterKey,
      filter_value: JSON.stringify(value),
      taxonomy_code: taxonomyCode,
    })
  }, [onChange, values, taxonomyCode])

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

  // Loading state - show appropriate skeleton
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
          {taxonomyCode ? (
            // Full filter skeleton when category is selected
            Array.from({ length: 6 }).map((_, groupIdx) => (
              <div key={groupIdx} className="space-y-4">
                {groupIdx > 0 && <Separator className="my-6" />}
                <Skeleton className="h-5 w-32" />
                {Array.from({ length: 2 }).map((_, filterIdx) => (
                  <div key={filterIdx} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ))
          ) : (
            // Supplier-only skeleton when no category
            <div className="space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // No taxonomy selected - show only Supplier filter with guidance
  if (!taxonomyCode) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            {values.supplier && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-8 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Supplier filter always available */}
          <SupplierFilter
            selectedSupplierId={values.supplier}
            onSupplierChange={(id) => handleFilterChange('supplier', id)}
            taxonomyCode={undefined}
          />

          {/* Guidance message for technical filters */}
          <Separator />
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-dashed">
            <Filter className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                More filters available
              </p>
              <p className="text-xs text-muted-foreground">
                Select a product category to access technical filters like IP rating, CCT, beam angle, and more.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Full filter panel when taxonomy is selected
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

      <CardContent className="p-0">
        {filterGroups.map((group) => (
          <FilterCategory
            key={group.name}
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
                        value={(values[filter.filter_key] as boolean | undefined) ?? null}
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
                        values={(values[filter.filter_key] as string[] | undefined) || []}
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
                        value={(values[filter.filter_key] as RangeValue | undefined) || {}}
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
        ))}
      </CardContent>
    </Card>
  )
}
