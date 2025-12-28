'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@fossapp/ui'
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
import { Button } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { Card, CardContent } from '@fossapp/ui'
import { Spinner } from '@fossapp/ui'
import { CheckCircle2, Circle, FileText, Trash2 } from 'lucide-react'
import {
  getAreaByIdAction,
  getAreaRevisionsAction,
  setAreaCurrentRevisionAction,
  deleteAreaRevisionAction,
  type AreaRevision,
  type ProjectArea,
} from '@/lib/actions'

interface AreaRevisionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  areaId: string
  onRevisionChange?: () => void
}

export function AreaRevisionHistoryDialog({
  open,
  onOpenChange,
  areaId,
  onRevisionChange,
}: AreaRevisionHistoryDialogProps) {
  const [area, setArea] = useState<ProjectArea | null>(null)
  const [revisions, setRevisions] = useState<AreaRevision[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingRevisions, setProcessingRevisions] = useState<Set<string>>(new Set())
  const [deleteConfirmRevision, setDeleteConfirmRevision] = useState<AreaRevision | null>(null)

  const formatCurrency = (amount: number | undefined, currency = 'EUR') => {
    if (!amount) return '€0.00'
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('el-GR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [areaResult, revisionsResult] = await Promise.all([
        getAreaByIdAction(areaId),
        getAreaRevisionsAction(areaId),
      ])

      if (areaResult.success && areaResult.data) {
        setArea(areaResult.data)
      }

      if (revisionsResult.success && revisionsResult.data) {
        setRevisions(revisionsResult.data)
      }
    } catch (error) {
      console.error('Error loading revision history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, areaId])

  const handleSetCurrent = async (revisionNumber: number) => {
    const revisionId = revisions.find(r => r.revision_number === revisionNumber)?.id
    if (!revisionId) return

    setProcessingRevisions(prev => new Set(prev).add(revisionId))
    try {
      const result = await setAreaCurrentRevisionAction(areaId, revisionNumber)
      if (result.success) {
        await loadData()
        onRevisionChange?.()
      } else {
        toast.error(result.error || 'Failed to set current revision')
      }
    } catch (error) {
      console.error('Error setting current revision:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setProcessingRevisions(prev => {
        const next = new Set(prev)
        next.delete(revisionId)
        return next
      })
    }
  }

  const handleDeleteClick = (revision: AreaRevision) => {
    if (area && revision.revision_number === area.current_revision) {
      toast.error('Cannot delete the current active revision')
      return
    }
    setDeleteConfirmRevision(revision)
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirmRevision) return
    const revision = deleteConfirmRevision
    setDeleteConfirmRevision(null)

    setProcessingRevisions(prev => new Set(prev).add(revision.id))
    try {
      const result = await deleteAreaRevisionAction(revision.id)
      if (result.success) {
        await loadData()
        onRevisionChange?.()
      } else {
        toast.error(result.error || 'Failed to delete revision')
      }
    } catch (error) {
      console.error('Error deleting revision:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setProcessingRevisions(prev => {
        const next = new Set(prev)
        next.delete(revision.id)
        return next
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {area ? `${area.area_name} - Revision History` : 'Revision History'}
          </DialogTitle>
          <DialogDescription>
            {area && (
              <>
                Area: <strong>{area.area_code}</strong> • Current revision:{' '}
                <strong>RV{area.current_revision}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Spinner size="lg" />
            </div>
          ) : revisions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No revisions found
            </div>
          ) : (
            <div className="space-y-3">
              {revisions.map((revision) => {
                const isCurrent = area && revision.revision_number === area.current_revision
                const isProcessing = processingRevisions.has(revision.id)

                return (
                  <Card
                    key={revision.id}
                    className={`${isCurrent ? 'border-primary' : ''} ${
                      isProcessing ? 'opacity-50' : ''
                    }`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {isCurrent ? (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                            <h4 className="font-semibold text-base">
                              Revision {revision.revision_number}
                              {revision.revision_name && ` - ${revision.revision_name}`}
                            </h4>
                            {isCurrent && (
                              <Badge variant="default">Current</Badge>
                            )}
                            <Badge
                              variant={
                                revision.status === 'approved'
                                  ? 'default'
                                  : revision.status === 'draft'
                                  ? 'outline'
                                  : 'secondary'
                              }
                              className="capitalize"
                            >
                              {revision.status}
                            </Badge>
                          </div>

                          {revision.notes && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {revision.notes}
                            </p>
                          )}

                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>
                              <strong className="text-foreground">
                                {revision.product_count || 0}
                              </strong>{' '}
                              products
                            </span>
                            <span>•</span>
                            <span>
                              <strong className="text-foreground">
                                {formatCurrency(revision.total_cost)}
                              </strong>
                            </span>
                          </div>

                          <div className="mt-2 text-xs text-muted-foreground">
                            Created: {formatDate(revision.created_at)}
                            {revision.created_by && ` by ${revision.created_by}`}
                          </div>

                          {revision.approved_at && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Approved: {formatDate(revision.approved_at)}
                              {revision.approved_by && ` by ${revision.approved_by}`}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 ml-4">
                          {!isCurrent && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetCurrent(revision.revision_number)}
                              disabled={isProcessing}
                              title="Set as current revision"
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Set Current
                            </Button>
                          )}
                          {!isCurrent && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(revision)}
                              disabled={isProcessing}
                              className="text-destructive hover:text-destructive"
                              title="Delete this revision"
                            >
                              {isProcessing ? (
                                <Spinner size="sm" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <div className="pt-4 border-t flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>

      {/* Delete Revision Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmRevision} onOpenChange={() => setDeleteConfirmRevision(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Revision?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete revision {deleteConfirmRevision?.revision_number}? This will also delete all products in this revision.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
