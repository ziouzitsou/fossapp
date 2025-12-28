'use client'

/**
 * Planner State Hook
 * Encapsulates all state management, effects, and handlers for the Planner page
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useActiveProject } from '@/lib/active-project-context'
import type { Viewer3DInstance, Placement, PlacementModeProduct, DwgUnitInfo } from '@/components/planner'
import type { AreaVersionOption } from './types'
import {
  listProjectAreasAction,
  listAreaVersionProductsAction,
  deleteAreaVersionFloorPlanAction,
  loadAreaPlacementsAction,
  saveAreaPlacementsAction,
  type AreaVersionProduct,
  type PlacementData
} from '@/lib/actions/project-areas'

export function usePlannerState() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeProject } = useActiveProject()

  // File/viewer state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedUrn, setSelectedUrn] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [dragOverAreaId, setDragOverAreaId] = useState<string | null>(null)
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)

  // Area-version selection
  const [areaVersions, setAreaVersions] = useState<AreaVersionOption[]>([])
  const [selectedAreaVersion, setSelectedAreaVersion] = useState<AreaVersionOption | null>(null)
  const [loadingAreas, setLoadingAreas] = useState(false)

  // Pending upload area - tracks which area a file input belongs to
  const [pendingUploadArea, setPendingUploadArea] = useState<AreaVersionOption | null>(null)

  // Deletion state
  const [deletingAreaId, setDeletingAreaId] = useState<string | null>(null)
  const [deleteConfirmArea, setDeleteConfirmArea] = useState<AreaVersionOption | null>(null)

  // Warnings dialog state
  const [warningsDialogArea, setWarningsDialogArea] = useState<AreaVersionOption | null>(null)
  const [warningsData, setWarningsData] = useState<Array<{ code: string; message: string }> | null>(null)
  const [loadingWarnings, setLoadingWarnings] = useState(false)

  // Unsaved changes dialog state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  // Viewer reference
  const viewerRef = useRef<Viewer3DInstance | null>(null)

  // Area version products
  const [products, setProducts] = useState<AreaVersionProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Placements state
  const [placements, setPlacements] = useState<Placement[]>([])
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [savedPlacements, setSavedPlacements] = useState<PlacementData[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [loadingPlacements, setLoadingPlacements] = useState(false)

  // Placement mode state
  const [placementMode, setPlacementMode] = useState<PlacementModeProduct | null>(null)

  // DWG unit info from the viewer
  const [dwgUnitInfo, setDwgUnitInfo] = useState<DwgUnitInfo | null>(null)

  // Counter for generating unique dbIds
  const dbIdCounterRef = useRef(1000)

  // Compute dirty state by comparing current placements with saved state
  const isDirty = (() => {
    if (placements.length !== savedPlacements.length) return true
    return placements.some((p, i) => {
      const saved = savedPlacements[i]
      if (!saved) return true
      return (
        p.id !== saved.id ||
        p.worldX !== saved.worldX ||
        p.worldY !== saved.worldY ||
        p.rotation !== saved.rotation ||
        p.projectProductId !== saved.projectProductId
      )
    })
  })()

  // Determine if we have areas
  const hasAreas = areaVersions.length > 0

  // ============================================================================
  // Effects
  // ============================================================================

  // Load project areas when active project changes
  useEffect(() => {
    async function loadAreas() {
      if (!activeProject?.id) {
        setAreaVersions([])
        setSelectedAreaVersion(null)
        return
      }

      setLoadingAreas(true)
      try {
        const result = await listProjectAreasAction(activeProject.id, true)
        if (result.success && result.data) {
          const options: AreaVersionOption[] = result.data
            .filter(area => area.current_version_data?.id)
            .map(area => ({
              areaId: area.id,
              areaCode: area.area_code,
              areaName: area.area_name,
              versionId: area.current_version_data!.id,
              versionNumber: area.current_version,
              floorPlanUrn: area.current_version_data!.floor_plan_urn,
              floorPlanFilename: area.current_version_data!.floor_plan_filename,
              floorPlanStatus: area.current_version_data!.floor_plan_status,
              floorPlanWarnings: area.current_version_data!.floor_plan_warnings
            }))

          setAreaVersions(options)

          // Auto-select area from URL param if present
          const areaIdFromUrl = searchParams.get('area')
          if (areaIdFromUrl && !selectedAreaVersion) {
            const areaFromUrl = options.find(a => a.areaId === areaIdFromUrl)
            if (areaFromUrl && areaFromUrl.floorPlanUrn) {
              setSelectedAreaVersion(areaFromUrl)
            }
          }

          // Check for stale "inprogress" translations
          const inProgressAreas = options.filter(av => av.floorPlanStatus === 'inprogress')
          if (inProgressAreas.length > 0) {
            const manifestUpdates = await Promise.all(
              inProgressAreas.map(async (area) => {
                try {
                  const res = await fetch(`/api/planner/manifest?areaVersionId=${area.versionId}`)
                  if (res.ok) {
                    const manifest = await res.json()
                    if (manifest.status === 'success' || manifest.status === 'failed') {
                      return {
                        versionId: area.versionId,
                        status: manifest.status,
                        warnings: manifest.warningCount || 0
                      }
                    }
                  }
                } catch (err) {
                  console.error(`Failed to check manifest for ${area.areaCode}:`, err)
                }
                return null
              })
            )

            const completedUpdates = manifestUpdates.filter(Boolean)
            if (completedUpdates.length > 0) {
              setAreaVersions(prev =>
                prev.map(av => {
                  const update = completedUpdates.find(u => u?.versionId === av.versionId)
                  if (update) {
                    return {
                      ...av,
                      floorPlanStatus: update.status,
                      floorPlanWarnings: update.warnings
                    }
                  }
                  return av
                })
              )
            }
          }
        } else {
          setAreaVersions([])
          setSelectedAreaVersion(null)
        }
      } catch (err) {
        console.error('Failed to load project areas:', err)
        setAreaVersions([])
        setSelectedAreaVersion(null)
      } finally {
        setLoadingAreas(false)
      }
    }

    loadAreas()
  }, [activeProject?.id])

  // Load products for selected area version
  useEffect(() => {
    async function loadProducts() {
      if (!selectedAreaVersion?.versionId) {
        setProducts([])
        return
      }

      setLoadingProducts(true)
      try {
        const result = await listAreaVersionProductsAction(selectedAreaVersion.versionId)
        if (result.success && result.data) {
          setProducts(result.data)
        } else {
          setProducts([])
        }
      } catch (err) {
        console.error('Failed to load area version products:', err)
        setProducts([])
      } finally {
        setLoadingProducts(false)
      }
    }

    loadProducts()
  }, [selectedAreaVersion?.versionId])

  // Update viewer when area-version changes
  useEffect(() => {
    setSelectedFile(null)
    setSelectedUrn(selectedAreaVersion?.floorPlanUrn || null)
    setSelectedFileName(selectedAreaVersion?.floorPlanFilename || null)
    setPlacements([])
    setSavedPlacements([])
    setSelectedPlacementId(null)
    setDwgUnitInfo(null)
    viewerRef.current = null
  }, [selectedAreaVersion?.versionId, selectedAreaVersion?.floorPlanUrn, selectedAreaVersion?.floorPlanFilename])

  // Load placements from database
  useEffect(() => {
    async function loadPlacements() {
      if (!selectedAreaVersion?.versionId || !selectedAreaVersion?.floorPlanUrn) {
        return
      }

      setLoadingPlacements(true)
      try {
        const result = await loadAreaPlacementsAction(selectedAreaVersion.versionId)
        if (result.success && result.data) {
          const loadedPlacements: Placement[] = result.data.map((p, index) => ({
            id: p.id,
            productId: p.productId,
            projectProductId: p.projectProductId,
            productName: p.productName,
            worldX: p.worldX,
            worldY: p.worldY,
            rotation: p.rotation,
            dbId: dbIdCounterRef.current + index
          }))
          dbIdCounterRef.current += result.data.length + 1
          setPlacements(loadedPlacements)
          setSavedPlacements(result.data)
        }
      } catch (err) {
        console.error('Failed to load placements:', err)
      } finally {
        setLoadingPlacements(false)
      }
    }

    loadPlacements()
  }, [selectedAreaVersion?.versionId, selectedAreaVersion?.floorPlanUrn])

  // Clear placements when file changes
  useEffect(() => {
    setPlacements([])
    setSavedPlacements([])
    setSelectedPlacementId(null)
  }, [selectedFile])

  // Navigation guard - warn user about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // ============================================================================
  // Handlers
  // ============================================================================

  // Drag handlers for area cards
  const handleCardDragOver = useCallback((e: React.DragEvent, areaId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setDragOverAreaId(areaId)
    }
  }, [])

  const handleCardDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverAreaId(null)
  }, [])

  const handleCardDrop = useCallback((e: React.DragEvent, area: AreaVersionOption) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverAreaId(null)

    const files = Array.from(e.dataTransfer.files)
    const dwgFile = files.find(f => f.name.toLowerCase().endsWith('.dwg'))

    if (dwgFile) {
      setSelectedAreaVersion(area)
      setSelectedFile(dwgFile)
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.name.toLowerCase().endsWith('.dwg') && pendingUploadArea) {
      setSelectedAreaVersion(pendingUploadArea)
      setSelectedFile(file)
    }
    e.target.value = ''
    setPendingUploadArea(null)
  }, [pendingUploadArea])

  // Clear file (actual implementation)
  const doClearFile = useCallback(() => {
    setSelectedFile(null)
    setSelectedUrn(null)
    setSelectedFileName(null)
    setSelectedAreaVersion(null)
    setPlacements([])
    setSavedPlacements([])
    setSelectedPlacementId(null)
    viewerRef.current = null
    const params = new URLSearchParams(searchParams.toString())
    params.delete('area')
    router.replace(params.toString() ? `?${params.toString()}` : '/planner', { scroll: false })
  }, [router, searchParams])

  // Clear file with unsaved changes check
  const clearFile = useCallback(() => {
    if (isDirty) {
      setShowUnsavedDialog(true)
    } else {
      doClearFile()
    }
  }, [isDirty, doClearFile])

  // Save placements to database
  const handleSavePlacements = useCallback(async () => {
    if (!selectedAreaVersion?.versionId || isSaving) return

    setIsSaving(true)
    try {
      const placementData: PlacementData[] = placements.map(p => ({
        id: p.id,
        projectProductId: p.projectProductId,
        productId: p.productId,
        productName: p.productName,
        worldX: p.worldX,
        worldY: p.worldY,
        rotation: p.rotation
      }))

      const result = await saveAreaPlacementsAction(selectedAreaVersion.versionId, placementData)
      if (result.success) {
        setSavedPlacements(placementData)
      } else {
        console.error('Save failed:', result.error)
        toast.error('Failed to save placements: ' + (result.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Save placements error:', err)
      toast.error('Failed to save placements')
    } finally {
      setIsSaving(false)
    }
  }, [selectedAreaVersion?.versionId, placements, isSaving])

  // Handle clicking on an area card
  const handleAreaCardClick = useCallback((area: AreaVersionOption) => {
    if (area.floorPlanUrn) {
      setSelectedAreaVersion(area)
      const params = new URLSearchParams(searchParams.toString())
      params.set('area', area.areaId)
      router.replace(`?${params.toString()}`, { scroll: false })
    } else {
      setPendingUploadArea(area)
      document.getElementById('dwg-upload')?.click()
    }
  }, [router, searchParams])

  // Handle clicking delete button
  const handleDeleteClick = useCallback((e: React.MouseEvent, area: AreaVersionOption) => {
    e.stopPropagation()
    if (!area.floorPlanUrn) return
    setDeleteConfirmArea(area)
  }, [])

  // Handle confirming deletion
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmArea) return

    setDeletingAreaId(deleteConfirmArea.areaId)
    setDeleteConfirmArea(null)

    try {
      const result = await deleteAreaVersionFloorPlanAction(deleteConfirmArea.versionId)
      if (result.success) {
        setAreaVersions(prev =>
          prev.map(av =>
            av.versionId === deleteConfirmArea.versionId
              ? { ...av, floorPlanUrn: undefined, floorPlanFilename: undefined }
              : av
          )
        )
      } else {
        toast.error(result.error || 'Failed to delete floor plan')
      }
    } catch (err) {
      console.error('Delete floor plan error:', err)
      toast.error('Failed to delete floor plan')
    } finally {
      setDeletingAreaId(null)
    }
  }, [deleteConfirmArea])

  // Handle clicking warnings badge
  const handleWarningsClick = useCallback(async (e: React.MouseEvent, area: AreaVersionOption) => {
    e.stopPropagation()

    setWarningsDialogArea(area)
    setWarningsData(null)
    setLoadingWarnings(true)

    try {
      const res = await fetch(`/api/planner/manifest?areaVersionId=${area.versionId}`)
      if (res.ok) {
        const manifest = await res.json()
        setWarningsData(manifest.warnings || [])
      } else {
        setWarningsData([])
      }
    } catch (err) {
      console.error('Failed to fetch warnings:', err)
      setWarningsData([])
    } finally {
      setLoadingWarnings(false)
    }
  }, [])

  // Viewer ready callback
  const handleViewerReady = useCallback((viewer: Viewer3DInstance) => {
    viewerRef.current = viewer
  }, [])

  // DWG unit info callback
  const handleUnitInfoAvailable = useCallback((info: DwgUnitInfo) => {
    setDwgUnitInfo(info)
  }, [])

  // Placement handlers
  const handlePlacementAdd = useCallback((placement: Omit<Placement, 'dbId'>) => {
    console.log('[PlannerPage] handlePlacementAdd called:', placement)
    const newPlacement: Placement = {
      ...placement,
      dbId: dbIdCounterRef.current++,
    }
    setPlacements(prev => {
      console.log('[PlannerPage] Updating placements:', prev.length, '->', prev.length + 1)
      return [...prev, newPlacement]
    })
    setSelectedPlacementId(newPlacement.id)

    // Check if product quantity is now exhausted
    if (placementMode) {
      const currentCount = placements.filter(p => p.projectProductId === placementMode.projectProductId).length
      const product = products.find(p => p.id === placementMode.projectProductId)

      if (product && currentCount + 1 >= product.quantity) {
        setPlacementMode(null)
      }
    }
  }, [placements, placementMode, products])

  const handlePlacementSelect = useCallback((id: string | null) => {
    setSelectedPlacementId(id)
  }, [])

  const handlePlacementDelete = useCallback((id: string) => {
    setPlacements(prev => prev.filter(p => p.id !== id))
    if (selectedPlacementId === id) {
      setSelectedPlacementId(null)
    }
  }, [selectedPlacementId])

  // Enter placement mode
  const handleEnterPlacementMode = useCallback((product: PlacementModeProduct) => {
    setPlacementMode(product)
    setSelectedPlacementId(null)
  }, [])

  // Exit placement mode
  const handleExitPlacementMode = useCallback(() => {
    setPlacementMode(null)
  }, [])

  // Handle upload complete
  const handleUploadComplete = useCallback((urn: string, isNewUpload: boolean, fileName: string) => {
    console.log('Upload complete:', { urn: urn.substring(0, 20) + '...', isNewUpload, fileName })
    if (selectedAreaVersion) {
      setAreaVersions(prev =>
        prev.map(av =>
          av.versionId === selectedAreaVersion.versionId
            ? {
                ...av,
                floorPlanUrn: urn,
                floorPlanFilename: fileName,
                floorPlanStatus: isNewUpload ? 'inprogress' : 'success'
              }
            : av
        )
      )
    }
  }, [selectedAreaVersion])

  // Handle translation complete
  const handleTranslationComplete = useCallback(async () => {
    if (selectedAreaVersion) {
      try {
        const res = await fetch(`/api/planner/manifest?areaVersionId=${selectedAreaVersion.versionId}`)
        if (res.ok) {
          const manifest = await res.json()
          setAreaVersions(prev =>
            prev.map(av =>
              av.versionId === selectedAreaVersion.versionId
                ? {
                    ...av,
                    floorPlanStatus: 'success',
                    floorPlanWarnings: manifest.warningCount || 0
                  }
                : av
            )
          )
        }
      } catch (err) {
        console.error('Failed to fetch manifest:', err)
      }
    }
  }, [selectedAreaVersion])

  return {
    // Context
    activeProject,

    // File/viewer state
    selectedFile,
    selectedUrn,
    selectedFileName,
    dragOverAreaId,
    isPanelCollapsed,
    setIsPanelCollapsed,
    viewerRef,
    dwgUnitInfo,

    // Area state
    areaVersions,
    selectedAreaVersion,
    loadingAreas,
    hasAreas,

    // Deletion state
    deletingAreaId,
    deleteConfirmArea,
    setDeleteConfirmArea,

    // Warnings state
    warningsDialogArea,
    setWarningsDialogArea,
    warningsData,
    loadingWarnings,

    // Unsaved dialog state
    showUnsavedDialog,
    setShowUnsavedDialog,

    // Products state
    products,
    loadingProducts,

    // Placements state
    placements,
    selectedPlacementId,
    isSaving,
    loadingPlacements,
    isDirty,

    // Placement mode
    placementMode,

    // Handlers
    handleCardDragOver,
    handleCardDragLeave,
    handleCardDrop,
    handleFileChange,
    clearFile,
    doClearFile,
    handleSavePlacements,
    handleAreaCardClick,
    handleDeleteClick,
    handleConfirmDelete,
    handleWarningsClick,
    handleViewerReady,
    handleUnitInfoAvailable,
    handlePlacementAdd,
    handlePlacementSelect,
    handlePlacementDelete,
    handleEnterPlacementMode,
    handleExitPlacementMode,
    handleUploadComplete,
    handleTranslationComplete,
  }
}
