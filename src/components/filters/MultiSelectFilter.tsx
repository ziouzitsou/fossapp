/**
 * MultiSelectFilter - Checkbox list for ETIM Alphanumeric (A) type features
 *
 * Renders a scrollable list of checkboxes with product counts, allowing
 * multiple selections. Supports optional search, color swatches, and icons.
 *
 * @remarks
 * **Features**:
 * - Searchable when more than 10 options
 * - Color swatches for finishing colors
 * - IP rating icons (droplets for water protection level)
 * - Product counts from facets
 *
 * @example
 * IP Rating:
 * [ ] IP20 (1,234)
 * [x] IP44 (567)
 * [x] IP65 (890)
 */
'use client'

import { useState } from 'react'
import { MultiSelectFilterProps } from './types'
import { X, Search, Droplets, Droplet, CloudRain, Umbrella, Home } from 'lucide-react'
export default function MultiSelectFilter({
  filterKey,
  label,
  etimFeatureType,
  values,
  onChange,
  facets,
  options = {},
  onClear,
  showClearButton = true
}: MultiSelectFilterProps) {
  const {
    searchable = false,
    maxHeight = '12rem',
    showCount = true,
    showIcons = false,
    colorSwatches = false
  } = options

  const [searchTerm, setSearchTerm] = useState('')

  // Filter facets based on search term
  const filteredFacets = facets.filter(facet =>
    facet.filter_value != null && facet.filter_value.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleToggle = (value: string) => {
    const newValues = values.includes(value)
      ? values.filter(v => v !== value)
      : [...values, value]

    onChange(newValues)
  }

  const getColorSwatch = (colorName: string) => {
    const colorMap: Record<string, string> = {
      'Black': '#000000',
      'White': '#FFFFFF',
      'Gold': '#FFD700',
      'Silver': '#C0C0C0',
      'Bronze': '#CD7F32',
      'Grey': '#808080',
      'Gray': '#808080',
      'Anthracite': '#293133',
      'Brass': '#B5A642',
      'Green': '#008000',
      'Aluminium': '#A8A9AD',
      'Stainless steel': '#C0C0C0',
      'Chrome': '#E8E8E8',
      'Brown': '#964B00',
      'Pink': '#FFC0CB'
    }
    return colorMap[colorName] || '#CCCCCC'
  }

  const getIPIcon = (ipRating: string) => {
    // Simple IP rating icons
    const iconClass = "w-3.5 h-3.5"
    if (ipRating.startsWith('IP6')) return <Droplets className={iconClass} /> // High protection
    if (ipRating.startsWith('IP5')) return <Droplet className={iconClass} /> // Medium protection
    if (ipRating.startsWith('IP4')) return <CloudRain className={iconClass} /> // Splash protection
    if (ipRating.startsWith('IP2')) return <Umbrella className={iconClass} /> // Basic protection
    return <Home className={iconClass} /> // Indoor
  }

  return (
    <div className="space-y-2">
      {/* Label with clear button */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          {label} {etimFeatureType && <span className="text-muted-foreground">[{etimFeatureType}]</span>}
        </label>
        {showClearButton && values.length > 0 && onClear && (
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Clear ${label} filter`}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Search input (if searchable) */}
      {searchable && facets.length > 10 && (
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            className="w-full pl-8 pr-2 py-1 text-sm border border-input rounded-md bg-background focus:ring-1 focus:ring-ring focus:border-ring"
          />
        </div>
      )}

      {/* Options list */}
      <div
        className="space-y-1 overflow-y-auto pr-1"
        style={{ maxHeight }}
      >
        {filteredFacets.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2 text-center">
            No {label.toLowerCase()} found
          </div>
        ) : (
          filteredFacets.map((facet) => {
            const isChecked = values.includes(facet.filter_value)

            return (
              <label
                key={facet.filter_value}
                className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 p-1 rounded transition-colors group"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(facet.filter_value)}
                  className="rounded border-input text-primary focus:ring-ring"
                />

                {/* Color swatch (if enabled) */}
                {colorSwatches && (
                  <span
                    className="w-4 h-4 rounded border border-border shrink-0"
                    style={{ backgroundColor: getColorSwatch(facet.filter_value) }}
                    title={facet.filter_value}
                  />
                )}

                {/* Icon (if enabled) */}
                {showIcons && filterKey === 'ip' && (
                  <span className="text-xs" title={`${facet.filter_value} protection`}>
                    {getIPIcon(facet.filter_value)}
                  </span>
                )}

                {/* Value label */}
                <span className={`flex-1 ${isChecked ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {facet.filter_value}
                </span>

                {/* Product count */}
                {showCount && facet.product_count != null && (
                  <span className="text-xs text-muted-foreground">
                    ({facet.product_count.toLocaleString()})
                  </span>
                )}
              </label>
            )
          })
        )}
      </div>

      {/* Selection summary */}
      {values.length > 0 && (
        <div className="text-xs text-muted-foreground pt-1 border-t border-border">
          {values.length} selected
        </div>
      )}
    </div>
  )
}
