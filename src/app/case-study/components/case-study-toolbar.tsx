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
import type { ViewMode, CaseStudyArea } from '../types'

interface CaseStudyToolbarProps {
  areas: CaseStudyArea[]
  selectedAreaId: string
  onAreaChange: (areaId: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

/**
 * Case Study Toolbar - Area selector, view toggle, and action buttons
 *
 * Always visible at the top of the page. Controls:
 * - Area dropdown (switch between project areas)
 * - Products/Viewer toggle
 * - Upload DWG button
 * - Generate button (magic button)
 */
export function CaseStudyToolbar({
  areas,
  selectedAreaId,
  onAreaChange,
  viewMode,
  onViewModeChange,
}: CaseStudyToolbarProps) {
  const selectedArea = areas.find((a) => a.id === selectedAreaId)

  return (
    <div className="flex items-center gap-4 border-b bg-background px-4 py-2">
      {/* Area selector */}
      <Select value={selectedAreaId} onValueChange={onAreaChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select area">
            {selectedArea && (
              <span>
                <span className="font-medium">{selectedArea.areaCode}</span>
                <span className="text-muted-foreground"> - {selectedArea.areaName}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {areas.map((area) => (
            <SelectItem key={area.id} value={area.id}>
              <span className="font-medium">{area.areaCode}</span>
              <span className="text-muted-foreground"> - {area.areaName}</span>
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
