'use client'

import { BooleanFilterProps } from './types'
import { X } from 'lucide-react'

/**
 * BooleanFilter - For L (Logical) type filters
 * Displays Yes/No options with radio-button-like behavior
 * Example: Dimmable (Yes/No)
 */
export default function BooleanFilter({
  filterKey,
  label,
  etimFeatureType,
  value,
  onChange,
  facets,
  showCount = true,
  onClear,
  showClearButton = true
}: BooleanFilterProps) {
  // Sort facets: Yes first, then No
  const sortedFacets = [...facets].sort((a, b) => {
    const aIsYes = a.filter_value.toLowerCase() === 'yes'
    const bIsYes = b.filter_value.toLowerCase() === 'yes'
    return aIsYes === bIsYes ? 0 : aIsYes ? -1 : 1
  })

  const handleChange = (facetValue: string) => {
    const isYes = facetValue.toLowerCase() === 'yes'
    // If clicking the already-selected value, clear the filter
    if (value === isYes) {
      onClear?.()
    } else {
      onChange(isYes)
    }
  }

  return (
    <div className="space-y-2">
      {/* Label with clear button */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          {label} {etimFeatureType && <span className="text-muted-foreground">[{etimFeatureType}]</span>}
        </label>
        {showClearButton && value !== null && onClear && (
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Clear ${label} filter`}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Options */}
      <div className="space-y-1">
        {sortedFacets.map((facet) => {
          const isYes = facet.filter_value.toLowerCase() === 'yes'
          const isSelected = value === isYes

          return (
            <div
              key={facet.filter_value}
              className="flex items-center justify-between text-sm"
            >
              <label className="flex items-center gap-2 cursor-pointer flex-1 hover:bg-accent/50 p-1 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleChange(facet.filter_value)}
                  className="rounded border-input text-primary focus:ring-ring"
                />
                <span className={isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                  {facet.filter_value}
                </span>
              </label>
              {showCount && (
                <span className="text-xs text-muted-foreground">
                  ({facet.product_count.toLocaleString()})
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
