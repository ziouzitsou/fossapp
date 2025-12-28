'use client'

import { BooleanFilterProps } from './types'
import { ToggleGroup, ToggleGroupItem } from '@fossapp/ui'
import { Check, X, CircleDashed } from 'lucide-react'

/**
 * BooleanFilter - For L (Logical) type filters
 * Displays All/Yes/No toggle group with product counts
 * Example: Indoor (All | Yes 5,234 | No 8,242)
 */
export default function BooleanFilter({
  filterKey: _filterKey,
  label,
  etimFeatureType: _etimFeatureType,
  value,
  onChange,
  facets,
  showCount = true,
  onClear
}: BooleanFilterProps) {
  // Get counts from facets (DB returns standardized "Yes"/"No" values)
  const yesCount = facets.find(f => f.filter_value === 'Yes')?.product_count ?? 0
  const noCount = facets.find(f => f.filter_value === 'No')?.product_count ?? 0

  // Convert value to string for ToggleGroup
  const currentValue = value === null ? 'all' : value ? 'yes' : 'no'

  const handleValueChange = (newValue: string) => {
    if (newValue === 'all' || newValue === '') {
      onClear?.()
    } else {
      onChange(newValue === 'yes')
    }
  }

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

  return (
    <div className="space-y-2">
      {/* Label */}
      <label className="text-sm font-medium text-foreground">
        {label}
      </label>

      {/* Toggle Group */}
      <ToggleGroup
        type="single"
        value={currentValue}
        onValueChange={handleValueChange}
        className="justify-start gap-1 p-1 bg-muted/50 rounded-lg border"
      >
        <ToggleGroupItem
          value="all"
          className="px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-all
            data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground data-[state=off]:hover:bg-muted
            data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:font-medium data-[state=on]:shadow-xs"
        >
          <CircleDashed className="h-3.5 w-3.5" />
          All
        </ToggleGroupItem>
        <ToggleGroupItem
          value="yes"
          className="px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-all
            data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground data-[state=off]:hover:bg-muted
            data-[state=on]:bg-emerald-600 data-[state=on]:text-white data-[state=on]:font-medium data-[state=on]:shadow-xs"
        >
          <Check className="h-3.5 w-3.5" />
          Yes{showCount && yesCount > 0 && (
            <span className="ml-0.5 opacity-80">({formatCount(yesCount)})</span>
          )}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="no"
          className="px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-all
            data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground data-[state=off]:hover:bg-muted
            data-[state=on]:bg-rose-600 data-[state=on]:text-white data-[state=on]:font-medium data-[state=on]:shadow-xs"
        >
          <X className="h-3.5 w-3.5" />
          No{showCount && noCount > 0 && (
            <span className="ml-0.5 opacity-80">({formatCount(noCount)})</span>
          )}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
