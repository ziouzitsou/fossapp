'use client'

import { RangeFilterProps } from './types'
import { X } from 'lucide-react'

/**
 * RangeFilter - For R (Range) type filters
 * Displays min/max inputs with optional presets and histogram
 * Examples: CCT (Color Temperature), Luminous Flux (Lumens)
 */
export default function RangeFilter({
  filterKey,
  label,
  etimFeatureType,
  value,
  onChange,
  unit = '',
  minBound,
  maxBound,
  step = 1,
  presets = [],
  showHistogram = false,
  facets = [],
  onClear,
  showClearButton = true
}: RangeFilterProps) {
  const handleMinChange = (val: string) => {
    const numVal = val ? parseFloat(val) : undefined
    onChange({ ...value, min: numVal })
  }

  const handleMaxChange = (val: string) => {
    const numVal = val ? parseFloat(val) : undefined
    onChange({ ...value, max: numVal })
  }

  const applyPreset = (preset: { min: number; max: number }) => {
    onChange({ min: preset.min, max: preset.max })
  }

  const hasValue = value.min !== undefined || value.max !== undefined

  // Get range info from facets
  const rangeInfo = facets.length > 0 ? facets[0] : null

  return (
    <div className="space-y-2">
      {/* Label with clear button */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          {label} {etimFeatureType && <span className="text-muted-foreground">[{etimFeatureType}]</span>}
        </label>
        {showClearButton && hasValue && onClear && (
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Clear ${label} filter`}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Range info from facets */}
      {rangeInfo && rangeInfo.min_numeric_value != null && rangeInfo.max_numeric_value != null && (
        <div className="text-xs text-muted-foreground">
          Range: {rangeInfo.min_numeric_value.toLocaleString()} - {rangeInfo.max_numeric_value.toLocaleString()} {unit}
        </div>
      )}

      {/* Presets */}
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="text-xs px-2 py-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors"
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Min/Max inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Min {unit}</label>
          <input
            type="number"
            value={value.min ?? ''}
            onChange={(e) => handleMinChange(e.target.value)}
            placeholder={minBound?.toString() || 'Min'}
            min={minBound}
            max={value.max || maxBound}
            step={step}
            className="w-full px-2 py-1 text-sm border border-input rounded-md bg-background focus:ring-1 focus:ring-ring focus:border-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Max {unit}</label>
          <input
            type="number"
            value={value.max ?? ''}
            onChange={(e) => handleMaxChange(e.target.value)}
            placeholder={maxBound?.toString() || 'Max'}
            min={value.min || minBound}
            max={maxBound}
            step={step}
            className="w-full px-2 py-1 text-sm border border-input rounded-md bg-background focus:ring-1 focus:ring-ring focus:border-ring"
          />
        </div>
      </div>

      {/* Current selection summary */}
      {hasValue && (
        <div className="text-xs text-muted-foreground pt-1 border-t border-border">
          {value.min != null && value.max != null
            ? `${value.min.toLocaleString()} - ${value.max.toLocaleString()} ${unit}`
            : value.min != null
            ? `≥ ${value.min.toLocaleString()} ${unit}`
            : value.max != null
            ? `≤ ${value.max.toLocaleString()} ${unit}`
            : ''}
        </div>
      )}

      {/* TODO: Histogram visualization */}
      {showHistogram && facets.length > 0 && (
        <div className="h-12 bg-secondary rounded flex items-end justify-center gap-px p-1">
          <div className="text-xs text-muted-foreground">Histogram</div>
        </div>
      )}
    </div>
  )
}
