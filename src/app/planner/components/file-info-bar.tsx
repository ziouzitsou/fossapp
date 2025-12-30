'use client'

/**
 * File Info Bar Component
 * Displays file information, save status, and controls in the planner viewer mode
 */

import { FileIcon, X, PanelRightClose, PanelRight, Loader2, Info, Save } from 'lucide-react'
import { Button, Badge } from '@fossapp/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@fossapp/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@fossapp/ui'
import { cn } from '@fossapp/ui'
import type { PlannerState } from '../types'

interface FileInfoBarProps {
  state: PlannerState
}

export function FileInfoBar({ state }: FileInfoBarProps) {
  return (
    <div className="flex-none flex items-center justify-between mb-4 mr-4 px-4 py-3 rounded-xl bg-muted/50 border">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <FileIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <p className="font-medium">
              {state.selectedFile?.name || state.selectedFileName || 'Floor Plan'}
            </p>
            {state.dwgUnitInfo && <DwgUnitInfoPopover info={state.dwgUnitInfo} />}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {state.selectedFile && (
              <span>{(state.selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
            )}
            {state.selectedAreaRevision && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {state.selectedAreaRevision.areaCode} RV{state.selectedAreaRevision.revisionNumber}
              </Badge>
            )}
            {state.selectedUrn && !state.selectedFile && (
              <span className="text-muted-foreground/70">From project storage</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Dirty indicator */}
        {state.isDirty && (
          <span className="text-xs text-amber-500 font-medium">● Unsaved</span>
        )}
        {/* Save button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={state.isDirty ? 'default' : 'ghost'}
                size="sm"
                onClick={state.handleSavePlacements}
                disabled={!state.isDirty || state.isSaving || !state.selectedAreaRevision?.revisionId}
                className={cn(
                  state.isDirty
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'text-muted-foreground'
                )}
              >
                {state.isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                Save
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{state.isDirty ? 'Save placements to database' : 'No changes to save'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="h-6 w-px bg-border mx-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => state.setIsPanelCollapsed(!state.isPanelCollapsed)}
          className="text-muted-foreground h-9 w-9"
          title={state.isPanelCollapsed ? 'Show products panel' : 'Hide products panel'}
        >
          {state.isPanelCollapsed ? (
            <PanelRight className="h-4 w-4" />
          ) : (
            <PanelRightClose className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={state.handleBackToOverview}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <X className="h-4 w-4 mr-1.5" />
          Close
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// DWG Unit Info Popover
// ============================================================================

interface DwgUnitInfoPopoverProps {
  info: NonNullable<PlannerState['dwgUnitInfo']>
}

function DwgUnitInfoPopover({ info }: DwgUnitInfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="p-0.5 rounded hover:bg-muted transition-colors">
          <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">DWG Unit Information</h4>
          <div className="space-y-2 text-sm">
            {info.unitString && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit String:</span>
                <span className="font-mono">{info.unitString}</span>
              </div>
            )}
            {info.displayUnit && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Display Unit:</span>
                <span className="font-mono">{info.displayUnit}</span>
              </div>
            )}
            {info.unitScale !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scale to Meters:</span>
                <span className="font-mono">{info.unitScale}</span>
              </div>
            )}
            {info.modelUnits && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model Units:</span>
                <span className="font-mono">{info.modelUnits}</span>
              </div>
            )}
            {info.pageUnits && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Page Units:</span>
                <span className="font-mono">{info.pageUnits}</span>
              </div>
            )}
            {!info.unitString && !info.displayUnit && !info.modelUnits && !info.pageUnits && (
              <p className="text-muted-foreground italic">No unit information available</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
