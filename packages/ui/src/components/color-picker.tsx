'use client'

import * as React from 'react'
import { HexColorPicker, HexColorInput } from 'react-colorful'

import { cn } from '../utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Button } from './button'

interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('w-full justify-start gap-2', className)}
        >
          <div
            className="h-5 w-5 rounded border border-input"
            style={{ backgroundColor: value }}
          />
          <span className="font-mono text-sm">{value.toUpperCase()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <HexColorPicker color={value} onChange={onChange} />
        <div className="mt-3">
          <HexColorInput
            color={value}
            onChange={onChange}
            prefixed
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { ColorPicker }
