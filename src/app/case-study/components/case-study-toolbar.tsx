'use client'

import { Button } from '@fossapp/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fossapp/ui'
import { LayoutGrid, Map, Upload, Sparkles } from 'lucide-react'
import { cn } from '@fossapp/ui'
import type { ViewMode } from '../page'

interface Area {
  id: string
  name: string
}

interface CaseStudyToolbarProps {
  areas: Area[]
  selectedAreaId: string
  onAreaChange: (areaId: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function CaseStudyToolbar({
  areas,
  selectedAreaId,
  onAreaChange,
  viewMode,
  onViewModeChange,
}: CaseStudyToolbarProps) {
  return (
    <div className="flex items-center gap-4 border-b bg-background px-4 py-2">
      {/* Area selector */}
      <Select value={selectedAreaId} onValueChange={onAreaChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select area" />
        </SelectTrigger>
        <SelectContent>
          {areas.map((area) => (
            <SelectItem key={area.id} value={area.id}>
              {area.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* View mode toggle */}
      <div className="flex rounded-md border">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'rounded-r-none gap-1.5',
            viewMode === 'products' && 'bg-muted'
          )}
          onClick={() => onViewModeChange('products')}
        >
          <LayoutGrid className="h-4 w-4" />
          Products
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'rounded-l-none gap-1.5',
            viewMode === 'viewer' && 'bg-muted'
          )}
          onClick={() => onViewModeChange('viewer')}
        >
          <Map className="h-4 w-4" />
          Viewer
        </Button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <Button variant="outline" size="sm" className="gap-1.5">
        <Upload className="h-4 w-4" />
        Upload DWG
      </Button>
      <Button size="sm" className="gap-1.5">
        <Sparkles className="h-4 w-4" />
        Generate
      </Button>
    </div>
  )
}
