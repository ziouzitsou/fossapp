'use client'

/**
 * Area Card Component
 * Displays a single area version card with floor plan status and actions
 */

import Image from 'next/image'
import { FileIcon, Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { Badge } from '@fossapp/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@fossapp/ui'
import { cn } from '@fossapp/ui'
import type { AreaVersionOption } from './types'

interface AreaCardProps {
  area: AreaVersionOption
  isDragOver: boolean
  isDeleting: boolean
  onDragOver: (e: React.DragEvent, areaId: string) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, area: AreaVersionOption) => void
  onClick: (area: AreaVersionOption) => void
  onDeleteClick: (e: React.MouseEvent, area: AreaVersionOption) => void
  onWarningsClick: (e: React.MouseEvent, area: AreaVersionOption) => void
}

export function AreaCard({
  area,
  isDragOver,
  isDeleting,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  onDeleteClick,
  onWarningsClick,
}: AreaCardProps) {
  const hasFloorPlan = !!area.floorPlanUrn

  return (
    <div
      onClick={() => onClick(area)}
      onDragOver={(e) => !hasFloorPlan && onDragOver(e, area.areaId)}
      onDragLeave={onDragLeave}
      onDrop={(e) => !hasFloorPlan && onDrop(e, area)}
      className={cn(
        'relative p-4 rounded-xl border-2 cursor-pointer transition-all',
        hasFloorPlan
          ? 'bg-card hover:bg-accent border-border hover:border-primary/50'
          : isDragOver
            ? 'bg-primary/10 border-primary border-dashed'
            : 'bg-muted/30 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/50'
      )}
    >
      {/* Area Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{area.areaCode}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              v{area.versionNumber}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {area.areaName}
          </p>
        </div>
      </div>

      {/* Content based on floor plan status */}
      {hasFloorPlan ? (
        <div className="flex items-center gap-3">
          {/* Thumbnail or fallback icon */}
          <div className="shrink-0 w-12 h-12 rounded-lg bg-muted overflow-hidden relative">
            {area.floorPlanStatus === 'success' ? (
              <Image
                src={`/api/planner/thumbnail?areaVersionId=${area.versionId}`}
                alt={area.floorPlanFilename || 'Floor plan thumbnail'}
                fill
                className="object-cover pointer-events-none"
                unoptimized
              />
            ) : area.floorPlanStatus === 'inprogress' ? (
              <div className="w-full h-full flex items-center justify-center bg-primary/10">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10">
                <FileIcon className="h-5 w-5 text-primary" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium truncate">
                {area.floorPlanFilename || 'Floor Plan'}
              </p>
              {/* Warning badge */}
              {(area.floorPlanWarnings ?? 0) > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => onWarningsClick(e, area)}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        <span className="text-[10px] font-medium">{area.floorPlanWarnings}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to view {area.floorPlanWarnings} warning{area.floorPlanWarnings! > 1 ? 's' : ''}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {area.floorPlanStatus === 'inprogress' ? 'Processing...' : 'Click to open'}
            </p>
          </div>
          {/* Delete button */}
          <button
            onClick={(e) => onDeleteClick(e, area)}
            disabled={isDeleting}
            className={cn(
              'shrink-0 p-2 rounded-lg transition-colors',
              'hover:bg-destructive/10 hover:text-destructive',
              'text-muted-foreground',
              isDeleting && 'opacity-50 cursor-not-allowed'
            )}
            title="Delete floor plan"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className={cn(
            'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
            isDragOver ? 'bg-primary/20' : 'bg-muted'
          )}>
            <Plus className={cn(
              'h-5 w-5',
              isDragOver ? 'text-primary' : 'text-muted-foreground'
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn(
              'text-sm font-medium',
              isDragOver ? 'text-primary' : 'text-muted-foreground'
            )}>
              {isDragOver ? 'Drop to upload' : 'Upload DWG'}
            </p>
            <p className="text-xs text-muted-foreground">
              Click or drop file
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
