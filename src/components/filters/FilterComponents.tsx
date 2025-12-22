'use client'
import { useState, useEffect } from 'react'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FilterDefinition } from '@/lib/filters/actions'

// Type-safe Lucide icon lookup
type LucideIconName = keyof typeof LucideIcons
function getLucideIcon(name: string | undefined): LucideIcon | null {
  if (!name) return null
  const icon = LucideIcons[name as LucideIconName]
  if (typeof icon === 'function') return icon as LucideIcon
  return null
}

// ============================================================================
// Range Filter (e.g., CRI, CCT, Voltage)
// ============================================================================

interface RangeFilterProps {
  filter: FilterDefinition
  value?: { min: number; max: number }
  onChange: (value: { min: number; max: number } | undefined) => void
  actualRange?: { min: number; max: number }
}

export function RangeFilter({
  filter,
  value,
  onChange,
  actualRange
}: RangeFilterProps) {
  const configMin = filter.ui_config?.min || actualRange?.min || 0
  const configMax = filter.ui_config?.max || actualRange?.max || 100
  const step = filter.ui_config?.step || 1

  const [localValue, setLocalValue] = useState<[number, number]>([
    value?.min || configMin,
    value?.max || configMax
  ])

  // Reset when actual range changes (intentional state sync)
  useEffect(() => {
    if (!value) {
      setLocalValue([configMin, configMax])
    }
  }, [configMin, configMax, value])

  const handleChange = (newValue: number[]) => {
    setLocalValue([newValue[0], newValue[1]])
  }

  const handleCommit = (newValue: number[]) => {
    const isDefault = newValue[0] === configMin && newValue[1] === configMax
    onChange(isDefault ? undefined : { min: newValue[0], max: newValue[1] })
  }

  const IconComponent = getLucideIcon(filter.ui_config?.icon as string | undefined)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {IconComponent && <IconComponent className="h-4 w-4" />}
          <Label className="text-sm font-medium">{filter.label}</Label>
        </div>
        {value && (
          <button
            onClick={() => onChange(undefined)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      <div className="px-2">
        <Slider
          min={configMin}
          max={configMax}
          step={step}
          value={localValue}
          onValueChange={handleChange}
          onValueCommit={handleCommit}
          className="mb-4"
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {localValue[0]}{filter.etim_unit_id || ''}
        </span>
        <span className="text-muted-foreground">
          {localValue[1]}{filter.etim_unit_id || ''}
        </span>
      </div>

      {filter.ui_config?.help_text && (
        <p className="text-xs text-muted-foreground">
          {filter.ui_config.help_text}
        </p>
      )}
    </div>
  )
}

// ============================================================================
// Categorical Filter (e.g., IP Rating, Finishing Colour)
// ============================================================================

interface CategoricalFilterProps {
  filter: FilterDefinition
  value?: string[]
  onChange: (value: string[] | undefined) => void
  availableOptions?: Array<{ value: string; label: string; count?: number }>
}

export function CategoricalFilter({
  filter,
  value = [],
  onChange,
  availableOptions
}: CategoricalFilterProps) {
  const options: Array<{ value: string; label: string; count?: number }> =
    availableOptions || filter.ui_config?.options || []

  const handleToggle = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue]

    onChange(newValue.length === 0 ? undefined : newValue)
  }

  const IconComponent = getLucideIcon(filter.ui_config?.icon as string | undefined)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {IconComponent && <IconComponent className="h-4 w-4" />}
          <Label className="text-sm font-medium">{filter.label}</Label>
        </div>
        {value.length > 0 && (
          <button
            onClick={() => onChange(undefined)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {options.map((option) => {
          const isSelected = value.includes(option.value)

          return (
            <div
              key={option.value}
              className="flex items-center space-x-2 px-2 py-1 rounded-md transition-all hover:bg-primary/5"
            >
              <Checkbox
                id={`${filter.filter_key}-${option.value}`}
                checked={isSelected}
                onCheckedChange={() => handleToggle(option.value)}
              />
              <label
                htmlFor={`${filter.filter_key}-${option.value}`}
                className="flex-1 text-sm cursor-pointer flex items-center justify-between"
              >
                <span>{option.label}</span>
                {option.count !== undefined && (
                  <Badge variant="secondary" className="ml-2">
                    {option.count}
                  </Badge>
                )}
              </label>
            </div>
          )
        })}
      </div>

      {filter.ui_config?.help_text && (
        <p className="text-xs text-muted-foreground">
          {filter.ui_config.help_text}
        </p>
      )}
    </div>
  )
}

// ============================================================================
// Boolean Filter (e.g., Dimmable, Trimless, Indoor/Outdoor)
// ============================================================================

interface BooleanFilterProps {
  filter: FilterDefinition
  value?: boolean
  onChange: (value: boolean | undefined) => void
}

export function BooleanFilter({
  filter,
  value,
  onChange
}: BooleanFilterProps) {
  const labels = filter.ui_config?.labels || {
    true: 'Yes',
    false: 'No'
  }

  const IconComponent = getLucideIcon(filter.ui_config?.icon as string | undefined)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {IconComponent && <IconComponent className="h-4 w-4" />}
        <Label className="text-sm font-medium">{filter.label}</Label>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onChange(value === true ? undefined : true)}
          className={cn(
            'flex-1 px-3 py-2 text-sm rounded-md border transition-all',
            value === true
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:border-primary/50 hover:bg-muted/50 hover:scale-105'
          )}
        >
          {labels.true}
        </button>

        <button
          onClick={() => onChange(value === false ? undefined : false)}
          className={cn(
            'flex-1 px-3 py-2 text-sm rounded-md border transition-all',
            value === false
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:border-primary/50 hover:bg-muted/50 hover:scale-105'
          )}
        >
          {labels.false}
        </button>
      </div>

      {filter.ui_config?.help_text && (
        <p className="text-xs text-muted-foreground mt-2">
          {filter.ui_config.help_text}
        </p>
      )}
    </div>
  )
}
