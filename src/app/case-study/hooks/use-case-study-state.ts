'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  getCaseStudyProductsAction,
  getCaseStudyPlacementsAction,
  saveCaseStudyPlacementsAction,
  updateCaseStudyQuantityAction,
} from '../actions'
import type {
  LuminaireProduct,
  AccessoryProduct,
  Placement,
  ViewerCoordinates,
} from '../types'

/**
 * Main state management hook for the Case Study page
 *
 * Fetches real data from Supabase when areaRevisionId is provided.
 * Uses optimistic updates with debounced persistence.
 */
export function useCaseStudyState(areaRevisionId: string | null) {
  // ============================================================================
  // DATA STATE
  // ============================================================================

  const [luminaires, setLuminaires] = useState<LuminaireProduct[]>([])
  const [accessories, setAccessories] = useState<AccessoryProduct[]>([])
  const [placements, setPlacements] = useState<Placement[]>([])

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ============================================================================
  // VISIBILITY STATE (for symbol group show/hide)
  // ============================================================================

  const [hiddenSymbolGroups, setHiddenSymbolGroups] = useState<Set<string>>(new Set())

  // ============================================================================
  // REFS FOR DEBOUNCING
  // ============================================================================

  const placementSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingPlacementSaveRef = useRef(false)

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Ref to track current area revision (for refetch)
  const areaRevisionIdRef = useRef(areaRevisionId)
  areaRevisionIdRef.current = areaRevisionId

  /**
   * Fetch products and placements for the current area revision
   * Can be called manually via refetchProducts() for refreshing after adds
   */
  const fetchData = useCallback(async () => {
    const revisionId = areaRevisionIdRef.current
    if (!revisionId) {
      setLuminaires([])
      setAccessories([])
      setPlacements([])
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch products and placements in parallel
      const [productsResult, placementsResult] = await Promise.all([
        getCaseStudyProductsAction(revisionId),
        getCaseStudyPlacementsAction(revisionId),
      ])

      if (!productsResult.success) {
        setError(productsResult.error || 'Failed to fetch products')
        return
      }

      if (!placementsResult.success) {
        setError(placementsResult.error || 'Failed to fetch placements')
        return
      }

      setLuminaires(productsResult.data?.luminaires || [])
      setAccessories(productsResult.data?.accessories || [])
      setPlacements(placementsResult.data || [])
    } catch (err) {
      console.error('Case study data fetch error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch products and placements when area revision changes
  useEffect(() => {
    fetchData()
  }, [areaRevisionId, fetchData])

  // ============================================================================
  // PERSISTENCE: Auto-save placements (debounced)
  // ============================================================================

  const savePlacements = useCallback(() => {
    if (!areaRevisionId || !pendingPlacementSaveRef.current) return

    // Clear any existing timer
    if (placementSaveTimerRef.current) {
      clearTimeout(placementSaveTimerRef.current)
    }

    // Debounce save by 1 second
    placementSaveTimerRef.current = setTimeout(async () => {
      try {
        const result = await saveCaseStudyPlacementsAction(
          areaRevisionId,
          placements,
          luminaires
        )
        pendingPlacementSaveRef.current = false

        if (!result.success) {
          toast.error('Failed to save placements', {
            description: result.error || 'Please try again',
          })
        }
      } catch (err) {
        console.error('Failed to save placements:', err)
        toast.error('Failed to save placements', {
          description: 'Network error - changes may not be saved',
        })
      }
    }, 1000)
  }, [areaRevisionId, placements, luminaires])

  // Trigger save when placements change
  useEffect(() => {
    if (pendingPlacementSaveRef.current) {
      savePlacements()
    }
  }, [placements, savePlacements])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (placementSaveTimerRef.current) {
        clearTimeout(placementSaveTimerRef.current)
      }
    }
  }, [])

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  /** Get placements for a specific product */
  const getPlacementsForProduct = useCallback(
    (projectProductId: string): Placement[] => {
      return placements.filter((p) => p.projectProductId === projectProductId)
    },
    [placements]
  )

  /** Calculate placed count for a luminaire */
  const getPlacedCount = useCallback(
    (projectProductId: string): number => {
      return placements.filter((p) => p.projectProductId === projectProductId).length
    },
    [placements]
  )

  /** Luminaires with live placed counts */
  const luminairesWithCounts = useMemo(() => {
    return luminaires.map((lum) => ({
      ...lum,
      placed: getPlacedCount(lum.id),
    }))
  }, [luminaires, getPlacedCount])

  // ============================================================================
  // PRODUCT ACTIONS
  // ============================================================================

  /** Update luminaire quantity (+1 or -1) with optimistic update */
  const updateLuminaireQuantity = useCallback(
    async (productId: string, delta: number) => {
      // Find current product
      const product = luminaires.find((p) => p.id === productId)
      if (!product) return

      // Calculate new quantity (can't go below placed count)
      const placedCount = placements.filter(
        (pl) => pl.projectProductId === productId
      ).length
      const newQty = Math.max(placedCount, Math.max(1, product.quantity + delta))

      if (newQty === product.quantity) return

      // Optimistic update
      setLuminaires((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, quantity: newQty } : p))
      )

      // Persist to database
      try {
        const result = await updateCaseStudyQuantityAction(productId, newQty)
        if (!result.success) {
          // Revert on error
          setLuminaires((prev) =>
            prev.map((p) =>
              p.id === productId ? { ...p, quantity: product.quantity } : p
            )
          )
          console.error('Failed to update quantity:', result.error)
        }
      } catch (err) {
        // Revert on error
        setLuminaires((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, quantity: product.quantity } : p
          )
        )
        console.error('Failed to update quantity:', err)
      }
    },
    [luminaires, placements]
  )

  /** Update accessory quantity with optimistic update */
  const updateAccessoryQuantity = useCallback(
    async (productId: string, delta: number) => {
      // Find current product
      const product = accessories.find((p) => p.id === productId)
      if (!product) return

      const newQty = Math.max(0, product.quantity + delta)
      if (newQty === product.quantity) return

      // Optimistic update
      setAccessories((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, quantity: newQty } : p))
      )

      // Persist to database
      try {
        const result = await updateCaseStudyQuantityAction(
          productId,
          Math.max(1, newQty)
        )
        if (!result.success) {
          // Revert on error
          setAccessories((prev) =>
            prev.map((p) =>
              p.id === productId ? { ...p, quantity: product.quantity } : p
            )
          )
          console.error('Failed to update quantity:', result.error)
        }
      } catch (err) {
        // Revert on error
        setAccessories((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, quantity: product.quantity } : p
          )
        )
        console.error('Failed to update quantity:', err)
      }
    },
    [accessories]
  )

  // ============================================================================
  // PLACEMENT ACTIONS
  // ============================================================================

  /** Add a new placement (optimistic, auto-saves)
   * @param id - Placement ID from PlannerViewer (required to prevent duplicate markers)
   */
  const addPlacement = useCallback(
    (
      id: string,
      projectProductId: string,
      symbol: string,
      coords: ViewerCoordinates,
      rotation = 0
    ) => {
      const luminaire = luminaires.find((l) => l.id === projectProductId)
      if (!luminaire) return null

      const newPlacement: Placement = {
        id, // Use ID from PlannerViewer (already registered in renderedPlacementIdsRef)
        projectProductId,
        productId: luminaire.productId,
        symbol,
        worldX: coords.x,
        worldY: coords.y,
        rotation,
      }

      setPlacements((prev) => [...prev, newPlacement])
      pendingPlacementSaveRef.current = true

      return newPlacement
    },
    [luminaires]
  )

  /** Remove a placement (optimistic, auto-saves) */
  const removePlacement = useCallback((placementId: string) => {
    setPlacements((prev) => prev.filter((p) => p.id !== placementId))
    pendingPlacementSaveRef.current = true
  }, [])

  /** Update placement rotation (optimistic, auto-saves) */
  const updatePlacementRotation = useCallback(
    (placementId: string, rotation: number) => {
      setPlacements((prev) =>
        prev.map((p) =>
          p.id === placementId ? { ...p, rotation: rotation % 360 } : p
        )
      )
      pendingPlacementSaveRef.current = true
    },
    []
  )

  /** Update placement position (optimistic, auto-saves) */
  const updatePlacementPosition = useCallback(
    (placementId: string, coords: ViewerCoordinates) => {
      setPlacements((prev) =>
        prev.map((p) =>
          p.id === placementId ? { ...p, worldX: coords.x, worldY: coords.y } : p
        )
      )
      pendingPlacementSaveRef.current = true
    },
    []
  )

  // ============================================================================
  // VISIBILITY ACTIONS
  // ============================================================================

  /**
   * Toggle visibility of a symbol group (e.g., "A", "B")
   * Hidden groups have their markers removed from the viewer
   */
  const toggleSymbolGroupVisibility = useCallback((symbolLetter: string) => {
    setHiddenSymbolGroups((prev) => {
      const next = new Set(prev)
      if (next.has(symbolLetter)) {
        next.delete(symbolLetter)
      } else {
        next.add(symbolLetter)
      }
      return next
    })
  }, [])

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    // Data
    luminaires: luminairesWithCounts,
    accessories,
    placements,

    // Derived
    getPlacementsForProduct,
    getPlacedCount,

    // Product actions
    updateLuminaireQuantity,
    updateAccessoryQuantity,

    // Placement actions
    addPlacement,
    removePlacement,
    updatePlacementRotation,
    updatePlacementPosition,

    // Visibility actions
    hiddenSymbolGroups,
    toggleSymbolGroupVisibility,

    // Refresh
    refetchProducts: fetchData,

    // Loading
    isLoading,
    error,
  }
}

/** Return type of the hook for component props */
export type CaseStudyStateValue = ReturnType<typeof useCaseStudyState>
