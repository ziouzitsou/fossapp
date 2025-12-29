'use client'

/**
 * Floor Plan Card Component
 * Displays floor plan thumbnail and status for the planner overview mode
 */

import Image from 'next/image'
import { FileIcon, Loader2, Plus, Trash2, AlertTriangle, Map } from 'lucide-react'
import { Button } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@fossapp/ui'
import { cn } from '@fossapp/ui'
import type { AreaRevisionOption } from '../types'

interface FloorPlanCardProps {
  area: AreaRevisionOption
  isDeleting: boolean
  onUploadClick: () => void
  onDeleteClick: () => void
  onWarningsClick: () => void
  onOpenPlanner: () => void
}

export function FloorPlanCard({
  area,
  isDeleting,
  onUploadClick,
  onDeleteClick,
  onWarningsClick,
  onOpenPlanner,
}: FloorPlanCardProps) {
  const hasFloorPlan = !!area.floorPlanUrn
  const isProcessing = area.floorPlanStatus === 'inprogress'

  if (!hasFloorPlan) {
    return (
      <div
        onClick={onUploadClick}
        className={cn(
          'flex items-center gap-4 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all',
          'bg-muted/30 border-muted-foreground/30 hover:border-primary hover:bg-primary/5'
        )}
      >
        <div className="shrink-0 w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
          <Plus className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-muted-foreground">Upload Floor Plan</p>
          <p className="text-sm text-muted-foreground/70">
            Click to upload or drag & drop a DWG file
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border bg-card">
      {/* Thumbnail */}
      <div className="shrink-0 w-20 h-20 rounded-lg bg-muted overflow-hidden relative">
        {area.floorPlanStatus === 'success' ? (
          <Image
            src={`/api/planner/thumbnail?areaRevisionId=${area.revisionId}`}
            alt={area.floorPlanFilename || 'Floor plan thumbnail'}
            fill
            className="object-cover"
            unoptimized
          />
        ) : isProcessing ? (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <FileIcon className="h-6 w-6 text-primary" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">
            {area.floorPlanFilename || 'Floor Plan'}
          </p>
          {/* Warning badge */}
          {(area.floorPlanWarnings ?? 0) > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onWarningsClick()
                    }}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
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
        <p className="text-sm text-muted-foreground">
          {isProcessing ? 'Processing translation...' : 'Ready for placement'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={onOpenPlanner}
          disabled={isProcessing}
        >
          <Map className="h-4 w-4 mr-1.5" />
          Open Planner
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteClick()
                }}
                disabled={isDeleting}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete floor plan</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
