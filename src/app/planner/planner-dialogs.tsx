'use client'

/**
 * Planner Dialogs
 * Delete confirmation, warnings, and unsaved changes dialogs
 */

import { Loader2, AlertTriangle, Info, Save } from 'lucide-react'
import { Button } from '@fossapp/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@fossapp/ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@fossapp/ui'
import type { AreaVersionOption } from './types'

// ============================================================================
// Delete Confirmation Dialog
// ============================================================================

interface DeleteDialogProps {
  area: AreaVersionOption | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function DeleteConfirmDialog({ area, onOpenChange, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={!!area} onOpenChange={(open) => !open && onOpenChange(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Floor Plan</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove the floor plan from <strong>{area?.areaCode}</strong>?
            {area?.floorPlanFilename && (
              <span className="block mt-2 text-sm">
                File: <span className="font-mono text-foreground/80">{area.floorPlanFilename}</span>
              </span>
            )}
            <span className="block mt-2 text-muted-foreground">
              This will delete the DWG file from storage. You can upload a new one anytime.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============================================================================
// Translation Warnings Dialog
// ============================================================================

interface WarningsDialogProps {
  area: AreaVersionOption | null
  warnings: Array<{ code: string; message: string }> | null
  isLoading: boolean
  onOpenChange: (open: boolean) => void
}

export function WarningsDialog({ area, warnings, isLoading, onOpenChange }: WarningsDialogProps) {
  return (
    <Dialog open={!!area} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Translation Warnings
          </DialogTitle>
          <DialogDescription>
            {area?.areaCode} - {area?.floorPlanFilename}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : warnings && warnings.length > 0 ? (
            warnings.map((warning, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
              >
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                      {warning.code}
                    </p>
                    <p className="text-sm text-foreground/80">
                      {warning.message || 'No additional details available'}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No warning details available</p>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          These warnings are from Autodesk&apos;s translation service. They typically indicate minor issues
          that may affect how certain elements are displayed.
        </p>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Unsaved Changes Dialog
// ============================================================================

interface UnsavedDialogProps {
  open: boolean
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onDiscard: () => void
  onSaveAndClose: () => void
}

export function UnsavedChangesDialog({
  open,
  isSaving,
  onOpenChange,
  onDiscard,
  onSaveAndClose,
}: UnsavedDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved placement changes. What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={onDiscard}
          >
            Discard Changes
          </Button>
          <Button
            onClick={onSaveAndClose}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1.5" />
                Save & Close
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
