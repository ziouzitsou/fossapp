'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ProjectVersion } from '@/lib/actions'
import {
  createProjectVersionWithDriveAction,
  deleteProjectVersionWithDriveAction,
  archiveProjectWithDriveAction,
} from '@/lib/actions/project-drive'
import { useDevSession } from '@/lib/use-dev-session'

interface ProjectVersionsCardProps {
  projectId: string
  projectCode: string
  currentVersion: number
  versions: ProjectVersion[]
  googleDriveFolderId?: string
  isArchived: boolean
  onVersionChange?: () => void
}

export function ProjectVersionsCard({
  projectId,
  projectCode,
  currentVersion,
  versions,
  googleDriveFolderId,
  isArchived,
  onVersionChange,
}: ProjectVersionsCardProps) {
  const { data: session } = useDevSession()
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<ProjectVersion | null>(null)
  const [newVersionNotes, setNewVersionNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('el-GR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getDriveLink = (folderId: string) => {
    return `https://drive.google.com/drive/folders/${folderId}`
  }

  const handleCreateVersion = async () => {
    setIsCreating(true)
    setError(null)

    try {
      const result = await createProjectVersionWithDriveAction(
        projectId,
        newVersionNotes,
        session?.user?.name || undefined
      )
      if (result.success) {
        setShowCreateDialog(false)
        setNewVersionNotes('')
        onVersionChange?.()
      } else {
        setError(result.error || 'Failed to create version')
      }
    } catch (err) {
      console.error('Create version error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteVersion = async () => {
    if (!selectedVersion) return

    setIsDeleting(true)
    setError(null)

    try {
      const result = await deleteProjectVersionWithDriveAction(
        projectId,
        selectedVersion.version_number
      )
      if (result.success) {
        setShowDeleteDialog(false)
        setSelectedVersion(null)
        onVersionChange?.()
      } else {
        setError(result.error || 'Failed to delete version')
      }
    } catch (err) {
      console.error('Delete version error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleArchiveProject = async () => {
    setIsArchiving(true)
    setError(null)

    try {
      const result = await archiveProjectWithDriveAction(projectId)
      if (result.success) {
        setShowArchiveDialog(false)
        onVersionChange?.()
      } else {
        setError(result.error || 'Failed to archive project')
      }
    } catch (err) {
      console.error('Archive project error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsArchiving(false)
    }
  }

  const openDeleteDialog = (version: ProjectVersion) => {
    setSelectedVersion(version)
    setShowDeleteDialog(true)
  }

  // Sort versions by version number descending
  const sortedVersions = [...versions].sort((a, b) => b.version_number - a.version_number)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                Files & Versions
                {isArchived && <Badge variant="secondary">Archived</Badge>}
              </CardTitle>
              <CardDescription>
                Google Drive folder structure and version history
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {googleDriveFolderId && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a
                    href={getDriveLink(googleDriveFolderId)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M7.71 3.5L1.15 15l4.58 7.5h13.54l4.58-7.5L17.29 3.5H7.71zm5.79 3l5.08 8.5H6.42l5.08-8.5z" />
                    </svg>
                    Open in Drive
                  </a>
                </Button>
              )}
              {!isArchived && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    + New Version
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowArchiveDialog(true)}
                  >
                    Archive
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!googleDriveFolderId ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No Google Drive folder linked</p>
              <p className="text-sm text-muted-foreground">
                Projects created before Drive integration don't have folders.
              </p>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No versions recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedVersions.map((version) => (
                <div
                  key={version.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    version.version_number === currentVersion
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">v{version.version_number}</span>
                      {version.version_number === currentVersion && (
                        <Badge variant="default" className="text-xs">Current</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(version.created_at)}
                      {version.notes && (
                        <span className="italic"> - {version.notes}</span>
                      )}
                      {version.created_by && (
                        <span className="font-medium"> - by {version.created_by}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {version.google_drive_folder_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a
                          href={getDriveLink(version.google_drive_folder_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open version folder in Google Drive"
                        >
                          <svg
                            className="w-4 h-4"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      </Button>
                    )}
                    {!isArchived && versions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(version)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete this version"
                      >
                        <svg
                          className="w-4 h-4"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Version Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Version</DialogTitle>
            <DialogDescription>
              This will create a copy of the current version (v{currentVersion}) in Google Drive.
              All files will be duplicated to v{currentVersion + 1}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Version Notes (optional)</Label>
              <Textarea
                id="notes"
                value={newVersionNotes}
                onChange={(e) => setNewVersionNotes(e.target.value)}
                placeholder="e.g., Customer requested changes to main hall..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateVersion} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creating v{currentVersion + 1}...
                </>
              ) : (
                `Create v${currentVersion + 1}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Version Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete v{selectedVersion?.version_number} and all its files
              from Google Drive. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVersion}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete Version'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Project Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the project folder to the Archive in Google Drive and mark it as
              archived. The project will become read-only. You can still view files but cannot
              create new versions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveProject}
              disabled={isArchiving}
            >
              {isArchiving ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Archiving...
                </>
              ) : (
                'Archive Project'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
