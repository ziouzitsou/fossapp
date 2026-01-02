'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  type CaseStudyArea,
  type LuminaireProduct,
  type AccessoryProduct,
  type Placement,
  type ViewerCoordinates,
  MOCK_AREAS,
  MOCK_LUMINAIRES,
  MOCK_ACCESSORIES,
  MOCK_PLACEMENTS,
} from '../types'

/**
 * Main state management hook for the Case Study page
 *
 * Centralizes all state management in one place, making it easy to:
 * 1. Track state changes during development
 * 2. Replace mock data with real Supabase queries (Phase 3)
 * 3. Add persistence/undo functionality later
 */
export function useCaseStudyState() {
  // ============================================================================
  // DATA STATE (will come from Supabase in Phase 3)
  // Note: View mode and selected area are now derived from URL (case-study-shell.tsx)
  // ============================================================================

  const [areas] = useState<CaseStudyArea[]>(MOCK_AREAS)
  const [luminaires, setLuminaires] = useState<LuminaireProduct[]>(MOCK_LUMINAIRES)
  const [accessories, setAccessories] = useState<AccessoryProduct[]>(MOCK_ACCESSORIES)
  const [placements, setPlacements] = useState<Placement[]>(MOCK_PLACEMENTS)

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)

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

  /** Update product quantity (+1 or -1) */
  const updateLuminaireQuantity = useCallback((productId: string, delta: number) => {
    setLuminaires((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p
        // Can't reduce below placed count
        const placedCount = placements.filter((pl) => pl.projectProductId === productId).length
        const newQty = Math.max(placedCount, p.quantity + delta)
        return { ...p, quantity: newQty }
      })
    )
  }, [placements])

  /** Update accessory quantity */
  const updateAccessoryQuantity = useCallback((productId: string, delta: number) => {
    setAccessories((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p
        const newQty = Math.max(0, p.quantity + delta)
        return { ...p, quantity: newQty }
      })
    )
  }, [])

  // ============================================================================
  // PLACEMENT ACTIONS
  // ============================================================================

  /** Add a new placement */
  const addPlacement = useCallback(
    (projectProductId: string, symbol: string, coords: ViewerCoordinates, rotation = 0) => {
      const newPlacement: Placement = {
        id: `pl-${Date.now()}`,
        projectProductId,
        productId: luminaires.find((l) => l.id === projectProductId)?.productId ?? '',
        symbol,
        worldX: coords.x,
        worldY: coords.y,
        rotation,
      }
      setPlacements((prev) => [...prev, newPlacement])
      return newPlacement
    },
    [luminaires]
  )

  /** Remove a placement */
  const removePlacement = useCallback((placementId: string) => {
    setPlacements((prev) => prev.filter((p) => p.id !== placementId))
  }, [])

  /** Update placement rotation */
  const updatePlacementRotation = useCallback((placementId: string, rotation: number) => {
    setPlacements((prev) =>
      prev.map((p) => (p.id === placementId ? { ...p, rotation: rotation % 360 } : p))
    )
  }, [])

  /** Update placement position */
  const updatePlacementPosition = useCallback((placementId: string, coords: ViewerCoordinates) => {
    setPlacements((prev) =>
      prev.map((p) =>
        p.id === placementId ? { ...p, worldX: coords.x, worldY: coords.y } : p
      )
    )
  }, [])

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    // Data
    areas,
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

    // Loading
    isLoading,
    error,
  }
}

/** Return type of the hook for component props */
export type CaseStudyStateValue = ReturnType<typeof useCaseStudyState>
