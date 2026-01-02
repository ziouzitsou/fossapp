/**
 * RangeFilter - Dual-thumb slider for ETIM Range (R) type features
 *
 * Displays a slider with min/max values, an "All" toggle to bypass filtering,
 * and optional preset buttons for quick selection of common ranges.
 *
 * @remarks
 * **Features**:
 * - Auto-detects actual min/max from facet data
 * - "All" toggle clears the filter (undefined min/max)
 * - Presets defined per filter (e.g., Warm/Neutral/Cool for CCT)
 *
 * @example
 * CCT (K): [2700───────4000] [All: Off]
 * Presets: [Warm White] [Neutral White] [Cool White]
 */
'use client'

import { RangeFilterProps } from './types'
import { Slider } from '@fossapp/ui'
import { Switch } from '@fossapp/ui'
import { Label } from '@fossapp/ui'
export default function RangeFilter({
  filterKey,
  label,
  etimFeatureType,
  value,
  onChange,
  unit = '',
  minBound = 0,
  maxBound = 100,
  step = 1,
  presets = [],
  showHistogram: _showHistogram = false,
  facets = [],
}: RangeFilterProps) {
  // Get actual range from facets if available
  const rangeInfo = facets.length > 0 ? facets[0] : null
  const actualMin = rangeInfo?.min_numeric_value ?? minBound
  const actualMax = rangeInfo?.max_numeric_value ?? maxBound

  // Determine if "All" is selected (no filter applied)
  const isAllSelected = value.min === undefined && value.max === undefined

  // Current slider values (use bounds when "All" is selected)
  const sliderMin = value.min ?? actualMin
  const sliderMax = value.max ?? actualMax

  const handleSliderChange = (values: number[]) => {
    const [newMin, newMax] = values
    // If values match the full range, treat as "All"
    if (newMin === actualMin && newMax === actualMax) {
      onChange({ min: undefined, max: undefined })
    } else {
      onChange({ min: newMin, max: newMax })
    }
  }

  const handleAllToggle = (checked: boolean) => {
    if (checked) {
      // "All" selected - clear the filter
      onChange({ min: undefined, max: undefined })
    } else {
      // "All" deselected - apply current bounds as filter
      onChange({ min: actualMin, max: actualMax })
    }
  }

  const applyPreset = (preset: { min: number; max: number }) => {
    onChange({ min: preset.min, max: preset.max })
  }

  // Format value for display
  const formatValue = (val: number) => {
    if (val >= 1000) {
      return val.toLocaleString()
    }
    return val.toString()
  }

  return (
    <div className="space-y-3">
      {/* Header: Label + Range Display */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          {label}
          {unit && <span className="text-muted-foreground ml-1 text-xs">{unit}</span>}
        </label>
        <span className="text-sm text-muted-foreground tabular-nums">
          {isAllSelected
            ? `${formatValue(actualMin)}-${formatValue(actualMax)}`
            : `${formatValue(sliderMin)}-${formatValue(sliderMax)}`
          }
        </span>
      </div>

      {/* Dual-thumb Slider */}
      <Slider
        value={[sliderMin, sliderMax]}
        onValueChange={handleSliderChange}
        min={actualMin}
        max={actualMax}
        step={step}
        minStepsBetweenThumbs={step}
        disabled={isAllSelected}
        className={isAllSelected ? 'opacity-50' : ''}
      />

      {/* All Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id={`${filterKey}-all`}
          checked={isAllSelected}
          onCheckedChange={handleAllToggle}
        />
        <Label
          htmlFor={`${filterKey}-all`}
          className="text-sm text-muted-foreground cursor-pointer"
        >
          All
        </Label>
      </div>

      {/* Presets */}
      {presets.length > 0 && !isAllSelected && (
        <div className="flex flex-wrap gap-1 pt-1">
          {presets.map((preset) => {
            const isActive = value.min === preset.min && value.max === preset.max
            return (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                }`}
                title={preset.description}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ETIM feature code (for debugging) */}
      {etimFeatureType && (
        <div className="text-[10px] text-muted-foreground/50">
          {etimFeatureType}
        </div>
      )}
    </div>
  )
}
