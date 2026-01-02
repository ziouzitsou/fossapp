'use client'

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
import { Loader2, Trash2 } from 'lucide-react'

interface DeleteFloorPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filename: string | null
  placementCount: number
  onConfirm: () => void
  isDeleting?: boolean
}

/**
 * Confirmation dialog for deleting a floor plan and all its placements
 */
export function DeleteFloorPlanDialog({
  open,
  onOpenChange,
  filename,
  placementCount,
  onConfirm,
  isDeleting = false,
}: DeleteFloorPlanDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Floor Plan?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will permanently delete{' '}
                <span className="font-medium text-foreground">
                  {filename || 'the floor plan'}
                </span>{' '}
                from this area.
              </p>
              {placementCount > 0 && (
                <p className="text-destructive font-medium">
                  {placementCount} symbol marker{placementCount !== 1 ? 's' : ''} will also be deleted.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                You can upload a new floor plan after deletion.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
