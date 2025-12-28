'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { Spinner } from '@fossapp/ui'
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
import { Plus, History, FileText, Pencil, Trash2, FolderOpen } from 'lucide-react'
import { ProjectArea } from '@/lib/actions'
import { AreaFormDialog } from './area-form-dialog'
import { AreaRevisionHistoryDialog } from './area-revision-history-dialog'
import { deleteAreaAction, createAreaRevisionAction } from '@/lib/actions'
import { useDevSession } from '@/lib/use-dev-session'

interface ProjectAreasCardProps {
  projectId: string
  projectCode: string
  areas: ProjectArea[]
  onAreaChange: () => void
}

export function ProjectAreasCard({
  projectId,
  projectCode,
  areas,
  onAreaChange
}: ProjectAreasCardProps) {
  const { data: session } = useDevSession()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingArea, setEditingArea] = useState<ProjectArea | null>(null)
  const [historyAreaId, setHistoryAreaId] = useState<string | null>(null)
  const [processingAreas, setProcessingAreas] = useState<Set<string>>(new Set())
  const [deleteConfirmArea, setDeleteConfirmArea] = useState<ProjectArea | null>(null)

  const formatCurrency = (amount: number | undefined, currency = 'EUR') => {
    if (!amount) return '€0.00'
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  const getAreaTypeLabel = (type: string | undefined) => {
    const types: Record<string, string> = {
      floor: 'Floor',
      outdoor: 'Outdoor',
      room: 'Room',
      common_area: 'Common Area',
      parking: 'Parking',
      technical: 'Technical',
      other: 'Other'
    }
    return type ? types[type] || type : 'Area'
  }

  const handleCreateRevision = async (areaId: string, copyFrom?: number) => {
    setProcessingAreas(prev => new Set(prev).add(areaId))
    try {
      const result = await createAreaRevisionAction({
        area_id: areaId,
        copy_from_revision: copyFrom,
        notes: `Revision created from RV${copyFrom || 'scratch'}`,
        created_by: session?.user?.email || undefined
      })

      if (result.success) {
        onAreaChange()
      } else {
        toast.error(result.error || 'Failed to create revision')
      }
    } catch (error) {
      console.error('Error creating revision:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setProcessingAreas(prev => {
        const next = new Set(prev)
        next.delete(areaId)
        return next
      })
    }
  }

  const handleDeleteClick = (area: ProjectArea) => {
    setDeleteConfirmArea(area)
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirmArea) return
    const area = deleteConfirmArea
    setDeleteConfirmArea(null)

    setProcessingAreas(prev => new Set(prev).add(area.id))
    try {
      const result = await deleteAreaAction(area.id)
      if (result.success) {
        onAreaChange()
      } else {
        toast.error(result.error || 'Failed to delete area')
      }
    } catch (error) {
      console.error('Error deleting area:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setProcessingAreas(prev => {
        const next = new Set(prev)
        next.delete(area.id)
        return next
      })
    }
  }

  const handleEditArea = (area: ProjectArea) => {
    setEditingArea(area)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingArea(null)
  }

  const handleFormSuccess = () => {
    onAreaChange()
    handleFormClose()
  }

  const sortedAreas = [...areas].sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order
    }
    if (a.floor_level !== undefined && b.floor_level !== undefined) {
      return a.floor_level - b.floor_level
    }
    return a.area_code.localeCompare(b.area_code)
  })

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Project Areas</CardTitle>
              <CardDescription>
                Manage areas with independent revisions for {projectCode}
              </CardDescription>
            </div>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Area
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sortedAreas.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No areas defined yet</p>
              <p className="text-sm text-muted-foreground mb-6">
                Create areas like floors, gardens, or zones to organize products with independent revisions
              </p>
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Area
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedAreas.map((area) => {
                const isProcessing = processingAreas.has(area.id)
                const currentRevision = area.current_revision_data

                return (
                  <Card key={area.id} className={isProcessing ? 'opacity-50' : ''}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">
                              {area.area_name}
                            </CardTitle>
                            <Badge variant="outline" className="font-mono text-xs">
                              {area.area_code}
                            </Badge>
                            {area.area_type && (
                              <Badge variant="secondary" className="text-xs">
                                {getAreaTypeLabel(area.area_type)}
                              </Badge>
                            )}
                            {area.floor_level !== null && area.floor_level !== undefined && (
                              <Badge variant="outline" className="text-xs">
                                Level {area.floor_level}
                              </Badge>
                            )}
                          </div>
                          {area.description && (
                            <CardDescription>{area.description}</CardDescription>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>
                              Current: <strong className="text-foreground">RV{area.current_revision}</strong>
                            </span>
                            {currentRevision && (
                              <>
                                <span>•</span>
                                <span>
                                  <strong className="text-foreground">{currentRevision.product_count}</strong> products
                                </span>
                                <span>•</span>
                                <span>
                                  <strong className="text-foreground">{formatCurrency(currentRevision.total_cost)}</strong>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setHistoryAreaId(area.id)}
                            disabled={isProcessing}
                            title="Revision History"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateRevision(area.id, area.current_revision)}
                            disabled={isProcessing}
                            title="New Revision (copy from current)"
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            New Revision
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditArea(area)}
                            disabled={isProcessing}
                            title="Edit Area"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(area)}
                            disabled={isProcessing}
                            className="text-destructive hover:text-destructive"
                            title="Delete Area"
                          >
                            {isProcessing ? (
                              <Spinner size="sm" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {currentRevision && currentRevision.notes && (
                      <CardContent>
                        <div className="text-sm">
                          <p className="text-muted-foreground">
                            <strong>RV{currentRevision.revision_number} Notes:</strong> {currentRevision.notes}
                          </p>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Area Form Dialog */}
      <AreaFormDialog
        open={isFormOpen}
        onOpenChange={handleFormClose}
        projectId={projectId}
        area={editingArea}
        onSuccess={handleFormSuccess}
      />

      {/* Revision History Dialog */}
      {historyAreaId && (
        <AreaRevisionHistoryDialog
          open={!!historyAreaId}
          onOpenChange={(open) => !open && setHistoryAreaId(null)}
          areaId={historyAreaId}
          onRevisionChange={onAreaChange}
        />
      )}

      {/* Delete Area Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmArea} onOpenChange={() => setDeleteConfirmArea(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Area?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete area &quot;{deleteConfirmArea?.area_name}&quot;? This will delete all revisions and products in this area.
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
    </>
  )
}
