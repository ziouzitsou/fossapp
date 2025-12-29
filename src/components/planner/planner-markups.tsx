'use client'

/**
 * PlannerMarkups - Product placement markers using HTML overlay
 *
 * Uses HTML elements positioned at world coordinates, converted to screen
 * coordinates via getVisibleBounds(). Markers are appended to document.body
 * to avoid overflow:hidden clipping from ancestor containers.
 *
 * Key concepts:
 * - Uses world coordinates from the DWG model
 * - viewer.impl.getVisibleBounds() for 2D coordinate conversion
 * - Polling-based position updates for pan/zoom tracking
 * - Click-to-place handled by PlannerViewer (not drag-drop)
 */

import { useEffect, useRef, useCallback } from 'react'
import type { Placement } from './types'

// Debug flag
const DEBUG = false
const log = (...args: unknown[]) => DEBUG && console.log('[PlannerMarkups]', ...args)

interface PlannerMarkupsProps {
  /** Current placements to render */
  placements: Placement[]
  /** Currently selected placement ID */
  selectedId: string | null
  /** Called when a new placement is added via drag-drop */
  onPlacementAdd: (placement: Omit<Placement, 'id' | 'dbId'>) => void
  /** Called when a placement is selected */
  onPlacementSelect: (id: string | null) => void
  /** Called when a placement is deleted */
  onPlacementDelete: (id: string) => void
}

export function PlannerMarkups({
  placements,
  selectedId,
  onPlacementAdd,
  onPlacementSelect,
  onPlacementDelete,
}: PlannerMarkupsProps) {
  // Container ref for our overlay
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Map of placement id -> marker element
  const markersRef = useRef<Map<string, HTMLDivElement>>(new Map())
  // Track if viewer is ready
  const viewerReadyRef = useRef(false)

  // Create container appended to body (bypasses overflow:hidden)
  useEffect(() => {
    const container = document.createElement('div')
    container.id = 'planner-markers-overlay'
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
    `
    document.body.appendChild(container)
    containerRef.current = container
    log('Created overlay container on document.body')

    return () => {
      container.remove()
      containerRef.current = null
      markersRef.current.clear()
    }
  }, [])

  // Function to update marker positions based on current camera
  const updateMarkerPositions = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nopViewer = (window as any).NOP_VIEWER
    if (!nopViewer || !containerRef.current) return

    const viewerContainer = nopViewer.container as HTMLElement
    if (!viewerContainer) return

    const viewerRect = viewerContainer.getBoundingClientRect()

    // Get visible bounds for 2D coordinate conversion
    const visibleBounds = nopViewer.impl?.getVisibleBounds()
    if (!visibleBounds) return

    const visMinX = visibleBounds.min.x
    const visMaxX = visibleBounds.max.x
    const visMinY = visibleBounds.min.y
    const visMaxY = visibleBounds.max.y
    const visWidth = visMaxX - visMinX
    const visHeight = visMaxY - visMinY

    for (const placement of placements) {
      const marker = markersRef.current.get(placement.id)
      if (!marker) continue

      // Convert world coords to screen coords using visible bounds
      // Screen X = (worldX - visMinX) / visWidth * containerWidth
      // Screen Y = (visMaxY - worldY) / visHeight * containerHeight (Y flipped)
      const screenX = ((placement.worldX - visMinX) / visWidth) * viewerRect.width
      const screenY = ((visMaxY - placement.worldY) / visHeight) * viewerRect.height

      // Calculate absolute position on screen
      const absX = viewerRect.left + screenX
      const absY = viewerRect.top + screenY

      // Check if marker is within viewer bounds
      const isVisible = (
        screenX >= 0 &&
        screenX <= viewerRect.width &&
        screenY >= 0 &&
        screenY <= viewerRect.height
      )

      marker.style.left = `${absX}px`
      marker.style.top = `${absY}px`
      marker.style.display = isVisible ? 'flex' : 'none'
    }
  }, [placements])

  // Poll for position updates - CAMERA_CHANGE_EVENT doesn't fire reliably for 2D pan
  useEffect(() => {
    let rafId: number
    let lastBoundsStr = ''

    const checkForChanges = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nopViewer = (window as any).NOP_VIEWER
      if (!nopViewer) {
        rafId = requestAnimationFrame(checkForChanges)
        return
      }

      if (!viewerReadyRef.current) {
        viewerReadyRef.current = true
        updateMarkerPositions()
      }

      // Check if visible bounds changed (pan/zoom occurred)
      const bounds = nopViewer.impl?.getVisibleBounds?.()
      if (bounds) {
        const boundsStr = `${bounds.min.x},${bounds.min.y},${bounds.max.x},${bounds.max.y}`
        if (boundsStr !== lastBoundsStr) {
          lastBoundsStr = boundsStr
          updateMarkerPositions()
        }
      }

      rafId = requestAnimationFrame(checkForChanges)
    }

    rafId = requestAnimationFrame(checkForChanges)

    // Also update on resize
    const handleResize = () => updateMarkerPositions()
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [updateMarkerPositions])

  // Create/update/remove markers when placements change
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const existingIds = new Set(markersRef.current.keys())
    const newIds = new Set(placements.map(p => p.id))

    // Remove markers that no longer exist
    for (const id of existingIds) {
      if (!newIds.has(id)) {
        const marker = markersRef.current.get(id)
        marker?.remove()
        markersRef.current.delete(id)
      }
    }

    // Create or update markers
    for (const placement of placements) {
      let marker = markersRef.current.get(placement.id)
      const isSelected = placement.id === selectedId

      if (!marker) {
        // Create new marker
        marker = document.createElement('div')
        marker.dataset.placementId = placement.id
        marker.style.cssText = `
          position: fixed;
          width: 32px;
          height: 32px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          pointer-events: auto;
          transition: transform 0.1s, box-shadow 0.1s;
          font-size: 12px;
          font-weight: bold;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `

        // Click handler
        marker.addEventListener('click', (e) => {
          e.stopPropagation()
          onPlacementSelect(placement.id)
        })

        container.appendChild(marker)
        markersRef.current.set(placement.id, marker)
        log('Created marker for placement:', placement.id)
      }

      // Update marker appearance based on selection
      marker.style.backgroundColor = isSelected ? '#f59e0b' : '#3b82f6'
      marker.style.border = '2px solid white'
      marker.style.boxShadow = isSelected
        ? '0 0 0 3px rgba(245, 158, 11, 0.5), 0 2px 8px rgba(0,0,0,0.3)'
        : '0 2px 8px rgba(0,0,0,0.3)'
      marker.style.transform = isSelected
        ? 'translate(-50%, -50%) scale(1.2)'
        : 'translate(-50%, -50%)'

      // Show symbol or '?' for unclassified
      const symbolLabel = placement.symbol || '?'
      marker.textContent = symbolLabel
    }

    // Update positions after creating markers
    updateMarkerPositions()
  }, [placements, selectedId, onPlacementSelect, updateMarkerPositions])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
        // Don't delete if user is typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT') return
        e.preventDefault()
        onPlacementDelete(selectedId)
      }
      if (e.key === 'Escape') {
        onPlacementSelect(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, onPlacementDelete, onPlacementSelect])

  // Click on viewer background to deselect
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nopViewer = (window as any).NOP_VIEWER
      if (!nopViewer) return

      const container = nopViewer.container as HTMLElement
      if (!container) return

      // Check if click is on the viewer canvas (not on a marker)
      const target = e.target as HTMLElement
      if (target.tagName === 'CANVAS' && container.contains(target)) {
        onPlacementSelect(null)
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [onPlacementSelect])

  // Note: Drag-drop removed in favor of click-to-place (handled by PlannerViewer)

  // This component manages DOM elements directly, no React render
  return null
}
