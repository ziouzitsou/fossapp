'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { CaseStudyArea } from '../types'

/**
 * Floor plan upload hook for Case Study
 *
 * Manages file selection state and triggers for DWG upload.
 * The actual upload is handled by PlannerViewer component via /api/planner/upload
 */
export function useFloorPlanUpload(
  selectedArea: CaseStudyArea | null,
  projectId: string | null
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
  // SYNC LOCAL STATE WITH AREA DATA
  // ============================================================================

  // Reset local state when area changes
  useEffect(() => {
    setLocalUrn(null)
    setLocalFilename(null)
    setSelectedFile(null)
    setUploadError(null)
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
    },
    []
  )

  /** Clear selected file (cancel upload before it starts) */
  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null)
    setUploadError(null)
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

    // Viewer callbacks
    handleUploadStart,
    handleUploadComplete,
    handleTranslationComplete,
    handleUploadError,
  }
}

/** Return type for component props */
export type FloorPlanUploadValue = ReturnType<typeof useFloorPlanUpload>
