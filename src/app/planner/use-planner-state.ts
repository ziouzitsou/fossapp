'use client'

/**
 * Planner State Hook
 * Encapsulates all state management, effects, and handlers for the Planner page
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useActiveProject } from '@/lib/active-project-context'
import { useDevSession } from '@/lib/use-dev-session'
import type { Viewer3DInstance, Placement, PlacementModeProduct, DwgUnitInfo } from '@/components/planner'
import type { AreaRevisionOption } from './types'
import {
  listProjectAreasAction,
  listAreaRevisionProductsAction,
  deleteAreaRevisionFloorPlanAction,
  loadAreaPlacementsAction,
  saveAreaPlacementsAction,
  type AreaRevisionProduct,
  type PlacementData
} from '@/lib/actions/project-areas'
import { getUserPreferencesAction } from '@/lib/actions/user-preferences'
import { DEFAULT_VIEW_PREFERENCES } from '@/lib/actions/user-preferences-types'

export function usePlannerState() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeProject } = useActiveProject()
  const { data: session } = useDevSession()

  // File/viewer state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedUrn, setSelectedUrn] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [dragOverAreaId, setDragOverAreaId] = useState<string | null>(null)
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)

  // Area-revision selection
  const [areaRevisions, setAreaRevisions] = useState<AreaRevisionOption[]>([])
  const [selectedAreaRevision, setSelectedAreaRevision] = useState<AreaRevisionOption | null>(null)
  const [loadingAreas, setLoadingAreas] = useState(false)

  // View mode: 'overview' shows products grid, 'planner' shows floor plan viewer
  const [viewMode, setViewMode] = useState<'overview' | 'planner'>('overview')

  // Pending upload area - tracks which area a file input belongs to
  // Use both state and ref: state for React lifecycle, ref for synchronous access in callbacks
  const [pendingUploadArea, setPendingUploadArea] = useState<AreaRevisionOption | null>(null)
  const pendingUploadAreaRef = useRef<AreaRevisionOption | null>(null)

  // Deletion state
  const [deletingAreaId, setDeletingAreaId] = useState<string | null>(null)
  const [deleteConfirmArea, setDeleteConfirmArea] = useState<AreaRevisionOption | null>(null)

  // Warnings dialog state
  const [warningsDialogArea, setWarningsDialogArea] = useState<AreaRevisionOption | null>(null)
  const [warningsData, setWarningsData] = useState<Array<{ code: string; message: string }> | null>(null)
  const [loadingWarnings, setLoadingWarnings] = useState(false)

  // Unsaved changes dialog state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  // Viewer reference
  const viewerRef = useRef<Viewer3DInstance | null>(null)

  // File input ref - for reliable programmatic clicks
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Area revision products
  const [products, setProducts] = useState<AreaRevisionProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Placements state
  const [placements, setPlacements] = useState<Placement[]>([])
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [savedPlacements, setSavedPlacements] = useState<PlacementData[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [loadingPlacements, setLoadingPlacements] = useState(false)
  const [placementsRefreshKey, setPlacementsRefreshKey] = useState(0)
  const [productsRefreshKey, setProductsRefreshKey] = useState(0)

  // Placement mode state
  const [placementMode, setPlacementMode] = useState<PlacementModeProduct | null>(null)

  // DWG unit info from the viewer
  const [dwgUnitInfo, setDwgUnitInfo] = useState<DwgUnitInfo | null>(null)

  // User view preferences
  const [markerMinScreenPx, setMarkerMinScreenPx] = useState(DEFAULT_VIEW_PREFERENCES.marker_min_screen_px)
  const [viewerBgTopColor, setViewerBgTopColor] = useState(DEFAULT_VIEW_PREFERENCES.viewer_bg_top_color || '#2a2a2a')
  const [viewerBgBottomColor, setViewerBgBottomColor] = useState(DEFAULT_VIEW_PREFERENCES.viewer_bg_bottom_color || '#0a0a0a')
  const [reverseZoomDirection, setReverseZoomDirection] = useState(DEFAULT_VIEW_PREFERENCES.reverse_zoom_direction ?? false)

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
  const hasAreas = areaRevisions.length > 0

  // ============================================================================
  // Effects
  // ============================================================================

  // Load user view preferences
  useEffect(() => {
    async function loadPreferences() {
      if (!session?.user?.email) return

      const result = await getUserPreferencesAction(session.user.email)
      if (result.success && result.data) {
        const prefs = result.data.view_preferences
        setMarkerMinScreenPx(prefs.marker_min_screen_px)
        // Load background colors with fallback to defaults
        setViewerBgTopColor(prefs.viewer_bg_top_color || '#2a2a2a')
        setViewerBgBottomColor(prefs.viewer_bg_bottom_color || '#0a0a0a')
        // Load zoom direction preference
        setReverseZoomDirection(prefs.reverse_zoom_direction ?? false)
      }
    }

    loadPreferences()
  }, [session?.user?.email])

  // Load project areas when active project changes
  useEffect(() => {
    async function loadAreas() {
      if (!activeProject?.id) {
        setAreaRevisions([])
        setSelectedAreaRevision(null)
        return
      }

      setLoadingAreas(true)
      try {
        const result = await listProjectAreasAction(activeProject.id, true)
        if (result.success && result.data) {
          const options: AreaRevisionOption[] = result.data
            .filter(area => area.current_revision_data?.id)
            .map(area => ({
              areaId: area.id,
              areaCode: area.area_code,
              areaName: area.area_name,
              revisionId: area.current_revision_data!.id,
              revisionNumber: area.current_revision,
              floorPlanUrn: area.current_revision_data!.floor_plan_urn,
              floorPlanFilename: area.current_revision_data!.floor_plan_filename,
              floorPlanStatus: area.current_revision_data!.floor_plan_status,
              floorPlanWarnings: area.current_revision_data!.floor_plan_warnings
            }))

          setAreaRevisions(options)

          // Auto-select area from URL param if present, otherwise select first area
          const areaIdFromUrl = searchParams.get('area')
          if (areaIdFromUrl) {
            const areaFromUrl = options.find(a => a.areaId === areaIdFromUrl)
            if (areaFromUrl) {
              setSelectedAreaRevision(areaFromUrl)
              // If area has floor plan and URL indicates planner mode, open it
              if (areaFromUrl.floorPlanUrn && searchParams.get('mode') === 'planner') {
                setViewMode('planner')
              }
            }
          } else if (options.length > 0 && !selectedAreaRevision) {
            // Auto-select first area if none selected
            setSelectedAreaRevision(options[0])
          }

          // Check for stale "inprogress" translations
          const inProgressAreas = options.filter(av => av.floorPlanStatus === 'inprogress')
          if (inProgressAreas.length > 0) {
            const manifestUpdates = await Promise.all(
              inProgressAreas.map(async (area) => {
                try {
                  const res = await fetch(`/api/planner/manifest?areaRevisionId=${area.revisionId}`)
                  if (res.ok) {
                    const manifest = await res.json()
                    if (manifest.status === 'success' || manifest.status === 'failed') {
                      return {
                        revisionId: area.revisionId,
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
              setAreaRevisions(prev =>
                prev.map(av => {
                  const update = completedUpdates.find(u => u?.revisionId === av.revisionId)
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
          setAreaRevisions([])
          setSelectedAreaRevision(null)
        }
      } catch (err) {
        console.error('Failed to load project areas:', err)
        setAreaRevisions([])
        setSelectedAreaRevision(null)
      } finally {
        setLoadingAreas(false)
      }
    }

    loadAreas()
  }, [activeProject?.id])

  // Keep selectedAreaRevision in sync with areaRevisions updates
  // This ensures the overview shows updated floor plan info after upload/translation
  useEffect(() => {
    if (selectedAreaRevision) {
      const updatedArea = areaRevisions.find(a => a.revisionId === selectedAreaRevision.revisionId)
      if (updatedArea && (
        updatedArea.floorPlanUrn !== selectedAreaRevision.floorPlanUrn ||
        updatedArea.floorPlanStatus !== selectedAreaRevision.floorPlanStatus ||
        updatedArea.floorPlanFilename !== selectedAreaRevision.floorPlanFilename ||
        updatedArea.floorPlanWarnings !== selectedAreaRevision.floorPlanWarnings
      )) {
        setSelectedAreaRevision(updatedArea)
      }
    }
  }, [areaRevisions, selectedAreaRevision])

  // Load products for selected area revision
  useEffect(() => {
    async function loadProducts() {
      if (!selectedAreaRevision?.revisionId) {
        setProducts([])
        return
      }

      setLoadingProducts(true)
      try {
        const result = await listAreaRevisionProductsAction(selectedAreaRevision.revisionId)
        if (result.success && result.data) {
          setProducts(result.data)
        } else {
          setProducts([])
        }
      } catch (err) {
        console.error('Failed to load area revision products:', err)
        setProducts([])
      } finally {
        setLoadingProducts(false)
      }
    }

    loadProducts()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- productsRefreshKey intentionally triggers refetch
  }, [selectedAreaRevision?.revisionId, productsRefreshKey])

  // Update viewer when area-revision changes
  useEffect(() => {
    setSelectedFile(null)
    setSelectedUrn(selectedAreaRevision?.floorPlanUrn || null)
    setSelectedFileName(selectedAreaRevision?.floorPlanFilename || null)
    setPlacements([])
    setSavedPlacements([])
    setSelectedPlacementId(null)
    setDwgUnitInfo(null)
    viewerRef.current = null
  }, [selectedAreaRevision?.revisionId, selectedAreaRevision?.floorPlanUrn, selectedAreaRevision?.floorPlanFilename])

  // Load placements from database
  useEffect(() => {
    async function loadPlacements() {
      if (!selectedAreaRevision?.revisionId || !selectedAreaRevision?.floorPlanUrn) {
        return
      }

      setLoadingPlacements(true)
      try {
        const result = await loadAreaPlacementsAction(selectedAreaRevision.revisionId)
        if (result.success && result.data) {
          const loadedPlacements: Placement[] = result.data.map((p, index) => ({
            id: p.id,
            productId: p.productId,
            projectProductId: p.projectProductId,
            productName: p.productName,
            symbol: p.symbol,  // Include symbol for marker display
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- placementsRefreshKey intentionally triggers refetch
  }, [selectedAreaRevision?.revisionId, selectedAreaRevision?.floorPlanUrn, placementsRefreshKey])

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

  const handleCardDrop = useCallback((e: React.DragEvent, area: AreaRevisionOption) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverAreaId(null)

    const files = Array.from(e.dataTransfer.files)
    const dwgFile = files.find(f => f.name.toLowerCase().endsWith('.dwg'))

    if (dwgFile) {
      setSelectedAreaRevision(area)
      setSelectedFile(dwgFile)
      setViewMode('planner')  // Enter planner mode for upload
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Use ref for synchronous access - avoids stale closure issue when file dialog
    // opens before React re-renders with updated state
    const area = pendingUploadAreaRef.current
    if (file && file.name.toLowerCase().endsWith('.dwg') && area) {
      setSelectedAreaRevision(area)
      setSelectedFile(file)
      setViewMode('planner')  // Enter planner mode for upload
    }
    e.target.value = ''
    pendingUploadAreaRef.current = null
    setPendingUploadArea(null)
  }, [])

  // Clear file (actual implementation)
  const doClearFile = useCallback(() => {
    setSelectedFile(null)
    setSelectedUrn(null)
    setSelectedFileName(null)
    // Don't clear selectedAreaRevision - keep area selected, just exit planner mode
    setPlacements([])
    setSavedPlacements([])
    setSelectedPlacementId(null)
    setViewMode('overview')  // Return to overview mode
    setPlacementMode(null)
    viewerRef.current = null
    const params = new URLSearchParams(searchParams.toString())
    params.delete('mode')  // Clear mode param, keep area
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
    if (!selectedAreaRevision?.revisionId || isSaving) return

    setIsSaving(true)
    try {
      const placementData: PlacementData[] = placements.map(p => ({
        id: p.id,
        projectProductId: p.projectProductId,
        productId: p.productId,
        productName: p.productName,
        symbol: p.symbol,  // Include symbol for persistence
        worldX: p.worldX,
        worldY: p.worldY,
        rotation: p.rotation
      }))

      const result = await saveAreaPlacementsAction(selectedAreaRevision.revisionId, placementData)
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
  }, [selectedAreaRevision?.revisionId, placements, isSaving])

  // Handle selecting an area from dropdown
  const handleAreaSelect = useCallback((areaId: string) => {
    const area = areaRevisions.find(a => a.areaId === areaId)
    if (area) {
      setSelectedAreaRevision(area)
      setViewMode('overview')  // Always go to overview when switching areas
      const params = new URLSearchParams(searchParams.toString())
      params.set('area', area.areaId)
      params.delete('mode')  // Clear mode param
      router.replace(`?${params.toString()}`, { scroll: false })
    }
  }, [areaRevisions, router, searchParams])

  // Handle opening planner mode (floor plan viewer)
  const handleOpenPlanner = useCallback(() => {
    if (selectedAreaRevision?.floorPlanUrn) {
      // Ensure URN is set when opening planner (may have been cleared by previous close)
      setSelectedUrn(selectedAreaRevision.floorPlanUrn)
      setSelectedFileName(selectedAreaRevision.floorPlanFilename || null)
      setViewMode('planner')
      const params = new URLSearchParams(searchParams.toString())
      params.set('mode', 'planner')
      router.replace(`?${params.toString()}`, { scroll: false })
    }
  }, [selectedAreaRevision, router, searchParams])

  // Handle going back to overview mode
  const handleBackToOverview = useCallback(() => {
    setViewMode('overview')
    setPlacementMode(null)  // Exit placement mode
    // Trigger a refetch of placements and products to reflect any changes
    setPlacementsRefreshKey(prev => prev + 1)
    setProductsRefreshKey(prev => prev + 1)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('mode')
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  // Handle clicking on an area card (legacy - kept for compatibility)
  const handleAreaCardClick = useCallback((area: AreaRevisionOption) => {
    if (area.floorPlanUrn) {
      setSelectedAreaRevision(area)
      const params = new URLSearchParams(searchParams.toString())
      params.set('area', area.areaId)
      router.replace(`?${params.toString()}`, { scroll: false })
    } else {
      // Set ref immediately for synchronous access in handleFileChange
      pendingUploadAreaRef.current = area
      // Click file input FIRST, before any state updates
      // This ensures the click happens in the same user-gesture context
      fileInputRef.current?.click()
      // Then update state (for UI feedback if needed)
      setPendingUploadArea(area)
    }
  }, [router, searchParams])

  // Handle clicking delete button
  const handleDeleteClick = useCallback((e: React.MouseEvent, area: AreaRevisionOption) => {
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
      const result = await deleteAreaRevisionFloorPlanAction(deleteConfirmArea.revisionId)
      if (result.success) {
        setAreaRevisions(prev =>
          prev.map(av =>
            av.revisionId === deleteConfirmArea.revisionId
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
  const handleWarningsClick = useCallback(async (e: React.MouseEvent, area: AreaRevisionOption) => {
    e.stopPropagation()

    setWarningsDialogArea(area)
    setWarningsData(null)
    setLoadingWarnings(true)

    try {
      const res = await fetch(`/api/planner/manifest?areaRevisionId=${area.revisionId}`)
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
    if (selectedAreaRevision) {
      setAreaRevisions(prev =>
        prev.map(av =>
          av.revisionId === selectedAreaRevision.revisionId
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
  }, [selectedAreaRevision])

  // Handle translation complete
  const handleTranslationComplete = useCallback(async () => {
    if (selectedAreaRevision) {
      try {
        const res = await fetch(`/api/planner/manifest?areaRevisionId=${selectedAreaRevision.revisionId}`)
        if (res.ok) {
          const manifest = await res.json()
          setAreaRevisions(prev =>
            prev.map(av =>
              av.revisionId === selectedAreaRevision.revisionId
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
  }, [selectedAreaRevision])

  // Manual refresh for products list
  const refreshProducts = useCallback(() => {
    setProductsRefreshKey(prev => prev + 1)
  }, [])

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
    fileInputRef,
    pendingUploadAreaRef,
    dwgUnitInfo,
    markerMinScreenPx,
    viewerBgTopColor,
    viewerBgBottomColor,
    reverseZoomDirection,

    // Area state
    areaRevisions,
    selectedAreaRevision,
    loadingAreas,
    hasAreas,

    // View mode
    viewMode,
    setViewMode,

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
    refreshProducts,

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
    handleAreaSelect,
    handleOpenPlanner,
    handleBackToOverview,
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
