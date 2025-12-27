'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Input } from '@fossapp/ui'
import { Label } from '@fossapp/ui'
import { Spinner } from '@fossapp/ui'
import { deleteProjectAction } from '@/lib/actions'

interface DeleteProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  projectCode: string
  onSuccess?: () => void
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectCode,
  onSuccess,
}: DeleteProjectDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationInput, setConfirmationInput] = useState('')

  // Reset confirmation input when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmationInput('')
      setError(null)
    }
  }, [open])

  const isConfirmed = confirmationInput === projectCode

  const handleDelete = async () => {
    if (!isConfirmed) return

    setIsDeleting(true)
    setError(null)

    try {
      const result = await deleteProjectAction(projectId)

      if (result.success) {
        onOpenChange(false)
        onSuccess?.()
      } else {
        setError(result.error || 'Failed to delete project')
      }
    } catch (err) {
      console.error('Delete error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete Project</DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="p-4 bg-muted rounded-md">
            <p className="font-medium">{projectName}</p>
            <p className="text-sm text-muted-foreground font-mono">{projectCode}</p>
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="mb-2">This will permanently delete:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Project areas and versions</li>
              <li>Project products</li>
              <li>Project contacts</li>
              <li>Project documents</li>
              <li>Project phases</li>
              <li className="text-destructive font-medium">Google Drive folder and all files</li>
              <li className="text-destructive font-medium">Floor plan files (OSS bucket)</li>
            </ul>
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="confirm-delete" className="text-sm">
              Type <span className="font-mono font-bold text-foreground">{projectCode}</span> to confirm deletion
            </Label>
            <Input
              id="confirm-delete"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder={projectCode}
              className="font-mono"
              disabled={isDeleting}
              autoComplete="off"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || !isConfirmed}
          >
            {isDeleting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Deleting...
              </>
            ) : (
              'Delete Project'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
