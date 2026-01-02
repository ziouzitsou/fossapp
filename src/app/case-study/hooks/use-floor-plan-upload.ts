'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  countAreaPlacementsAction,
  deleteFloorPlanWithPlacementsAction,
} from '../actions'
import type { CaseStudyArea } from '../types'

/**
 * Floor plan upload hook for Case Study
 *
 * Manages file selection state and triggers for DWG upload.
 * Also handles deletion of floor plans with confirmation.
 * The actual upload is handled by PlannerViewer component via /api/planner/upload
 */
export function useFloorPlanUpload(
  selectedArea: CaseStudyArea | null,
  projectId: string | null,
  onFloorPlanDeleted?: () => void,
  onNavigateToViewer?: () => void
) {
  // ============================================================================
  // FILE STATE
  // ============================================================================

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Local URN state - keeps viewer showing after upload before area data refreshes
  const [localUrn, setLocalUrn] = useState<string | null>(null)
  const [localFilename, setLocalFilename] = useState<string | null>(null)

  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ============================================================================
  // DELETE DIALOG STATE
  // ============================================================================

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [placementCount, setPlacementCount] = useState(0)

  // ============================================================================
  // SYNC LOCAL STATE WITH AREA DATA
  // ============================================================================

  // Reset local state when area changes
  useEffect(() => {
    setLocalUrn(null)
    setLocalFilename(null)
    setSelectedFile(null)
    setUploadError(null)
    setShowDeleteDialog(false)
  }, [selectedArea?.id])

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  /** Get effective URN (local override or from area data) */
  const existingUrn = localUrn ?? selectedArea?.floorPlanUrn ?? null

  /** Get effective filename */
  const existingFilename = localFilename ?? selectedArea?.floorPlanFilename ?? null

  /** Check if area has a floor plan (local or from database) */
  const hasExistingFloorPlan = Boolean(existingUrn)

  // ============================================================================
  // FILE HANDLERS
  // ============================================================================

  /** Trigger the hidden file input */
  const triggerFileSelect = useCallback(() => {
    if (!selectedArea) {
      setUploadError('Please select an area first')
      return
    }
    if (!projectId) {
      setUploadError('No project selected')
      return
    }
    setUploadError(null)
    fileInputRef.current?.click()
  }, [selectedArea, projectId])

  /** Handle file selection from input */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]

      if (!file) {
        return
      }

      // Validate file type
      if (!file.name.toLowerCase().endsWith('.dwg')) {
        setUploadError('Only DWG files are supported')
        e.target.value = ''
        return
      }

      // Validate file size (max 512MB - DWG files can be large)
      const maxSizeMB = 512
      if (file.size > maxSizeMB * 1024 * 1024) {
        setUploadError(`File too large. Maximum size is ${maxSizeMB}MB`)
        e.target.value = ''
        return
      }

      setUploadError(null)
      setSelectedFile(file)

      // Reset input so same file can be selected again
      e.target.value = ''

      // Navigate to viewer page immediately so PlannerViewer can start translation
      onNavigateToViewer?.()
    },
    [onNavigateToViewer]
  )

  /** Clear selected file (cancel upload before it starts) */
  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null)
    setUploadError(null)
  }, [])

  // ============================================================================
  // DELETE HANDLERS
  // ============================================================================

  /** Open delete confirmation dialog */
  const triggerDelete = async () => {
    if (!selectedArea?.revisionId) {
      setUploadError('No area selected')
      return
    }

    // Fetch placement count to show in dialog
    try {
      const result = await countAreaPlacementsAction(selectedArea.revisionId)
      setPlacementCount(result.success ? result.data ?? 0 : 0)
    } catch {
      setPlacementCount(0)
    }

    setShowDeleteDialog(true)
  }

  /** Confirm and execute deletion */
  const confirmDelete = async () => {
    if (!selectedArea?.revisionId) return

    setIsDeleting(true)
    setUploadError(null)

    try {
      const result = await deleteFloorPlanWithPlacementsAction(selectedArea.revisionId)

      if (!result.success) {
        setUploadError(result.error || 'Failed to delete floor plan')
        setIsDeleting(false)
        setShowDeleteDialog(false)
        return
      }

      // Clear local state
      setLocalUrn(null)
      setLocalFilename(null)
      setSelectedFile(null)
      setShowDeleteDialog(false)
      setIsDeleting(false)

      // Notify parent to refresh data
      onFloorPlanDeleted?.()

      console.log(
        `[FloorPlanUpload] Deleted floor plan and ${result.data?.placementsDeleted ?? 0} placements`
      )
    } catch (err) {
      console.error('Delete floor plan error:', err)
      setUploadError('An unexpected error occurred')
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  /** Cancel delete dialog */
  const cancelDelete = useCallback(() => {
    setShowDeleteDialog(false)
  }, [])

  // ============================================================================
  // UPLOAD CALLBACKS (called by PlannerViewer)
  // ============================================================================

  /** Called when upload starts */
  const handleUploadStart = useCallback(() => {
    setIsUploading(true)
    setUploadError(null)
  }, [])

  /** Called when upload completes successfully */
  const handleUploadComplete = useCallback(
    (urn: string, isNewUpload: boolean, fileName: string) => {
      console.log(
        `[FloorPlanUpload] Upload complete: ${fileName} (${isNewUpload ? 'new' : 'cached'})`
      )
      setIsUploading(false)
      setSelectedFile(null)
      // Store URN locally so viewer keeps showing before area data refreshes
      setLocalUrn(urn)
      setLocalFilename(fileName)
    },
    []
  )

  /** Called when translation completes */
  const handleTranslationComplete = useCallback((urn: string) => {
    console.log('[FloorPlanUpload] Translation complete:', urn)
  }, [])

  /** Called on upload/translation error */
  const handleUploadError = useCallback((error: string) => {
    console.error('[FloorPlanUpload] Error:', error)
    setUploadError(error)
    setIsUploading(false)
    setSelectedFile(null)
  }, [])

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    // State
    selectedFile,
    isUploading,
    uploadError,
    hasExistingFloorPlan,
    existingUrn,
    existingFilename,

    // Refs
    fileInputRef,

    // Actions
    triggerFileSelect,
    handleFileChange,
    clearSelectedFile,

    // Delete dialog
    showDeleteDialog,
    isDeleting,
    placementCount,
    triggerDelete,
    confirmDelete,
    cancelDelete,

    // Viewer callbacks
    handleUploadStart,
    handleUploadComplete,
    handleTranslationComplete,
    handleUploadError,
  }
}

/** Return type for component props */
export type FloorPlanUploadValue = ReturnType<typeof useFloorPlanUpload>
