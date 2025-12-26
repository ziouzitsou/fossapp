'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { Card, CardContent } from '@fossapp/ui'
import { Spinner } from '@fossapp/ui'
import { CheckCircle2, Circle, FileText, Trash2 } from 'lucide-react'
import {
  getAreaByIdAction,
  getAreaVersionsAction,
  setAreaCurrentVersionAction,
  deleteAreaVersionAction,
  type AreaVersion,
  type ProjectArea,
} from '@/lib/actions'

interface AreaVersionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  areaId: string
  onVersionChange?: () => void
}

export function AreaVersionHistoryDialog({
  open,
  onOpenChange,
  areaId,
  onVersionChange,
}: AreaVersionHistoryDialogProps) {
  const [area, setArea] = useState<ProjectArea | null>(null)
  const [versions, setVersions] = useState<AreaVersion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingVersions, setProcessingVersions] = useState<Set<string>>(new Set())

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
      const [areaResult, versionsResult] = await Promise.all([
        getAreaByIdAction(areaId),
        getAreaVersionsAction(areaId),
      ])

      if (areaResult.success && areaResult.data) {
        setArea(areaResult.data)
      }

      if (versionsResult.success && versionsResult.data) {
        setVersions(versionsResult.data)
      }
    } catch (error) {
      console.error('Error loading version history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, areaId])

  const handleSetCurrent = async (versionNumber: number) => {
    const versionId = versions.find(v => v.version_number === versionNumber)?.id
    if (!versionId) return

    setProcessingVersions(prev => new Set(prev).add(versionId))
    try {
      const result = await setAreaCurrentVersionAction(areaId, versionNumber)
      if (result.success) {
        await loadData()
        onVersionChange?.()
      } else {
        alert(result.error || 'Failed to set current version')
      }
    } catch (error) {
      console.error('Error setting current version:', error)
      alert('An unexpected error occurred')
    } finally {
      setProcessingVersions(prev => {
        const next = new Set(prev)
        next.delete(versionId)
        return next
      })
    }
  }

  const handleDeleteVersion = async (version: AreaVersion) => {
    if (area && version.version_number === area.current_version) {
      alert('Cannot delete the current active version')
      return
    }

    if (!confirm(`Delete version ${version.version_number}? This will also delete all products in this version.`)) {
      return
    }

    setProcessingVersions(prev => new Set(prev).add(version.id))
    try {
      const result = await deleteAreaVersionAction(version.id)
      if (result.success) {
        await loadData()
        onVersionChange?.()
      } else {
        alert(result.error || 'Failed to delete version')
      }
    } catch (error) {
      console.error('Error deleting version:', error)
      alert('An unexpected error occurred')
    } finally {
      setProcessingVersions(prev => {
        const next = new Set(prev)
        next.delete(version.id)
        return next
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {area ? `${area.area_name} - Version History` : 'Version History'}
          </DialogTitle>
          <DialogDescription>
            {area && (
              <>
                Area: <strong>{area.area_code}</strong> • Current version:{' '}
                <strong>v{area.current_version}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Spinner size="lg" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No versions found
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => {
                const isCurrent = area && version.version_number === area.current_version
                const isProcessing = processingVersions.has(version.id)

                return (
                  <Card
                    key={version.id}
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
                              Version {version.version_number}
                              {version.version_name && ` - ${version.version_name}`}
                            </h4>
                            {isCurrent && (
                              <Badge variant="default">Current</Badge>
                            )}
                            <Badge
                              variant={
                                version.status === 'approved'
                                  ? 'default'
                                  : version.status === 'draft'
                                  ? 'outline'
                                  : 'secondary'
                              }
                              className="capitalize"
                            >
                              {version.status}
                            </Badge>
                          </div>

                          {version.notes && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {version.notes}
                            </p>
                          )}

                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>
                              <strong className="text-foreground">
                                {version.product_count || 0}
                              </strong>{' '}
                              products
                            </span>
                            <span>•</span>
                            <span>
                              <strong className="text-foreground">
                                {formatCurrency(version.total_cost)}
                              </strong>
                            </span>
                          </div>

                          <div className="mt-2 text-xs text-muted-foreground">
                            Created: {formatDate(version.created_at)}
                            {version.created_by && ` by ${version.created_by}`}
                          </div>

                          {version.approved_at && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Approved: {formatDate(version.approved_at)}
                              {version.approved_by && ` by ${version.approved_by}`}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 ml-4">
                          {!isCurrent && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetCurrent(version.version_number)}
                              disabled={isProcessing}
                              title="Set as current version"
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Set Current
                            </Button>
                          )}
                          {!isCurrent && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteVersion(version)}
                              disabled={isProcessing}
                              className="text-destructive hover:text-destructive"
                              title="Delete this version"
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
    </Dialog>
  )
}
