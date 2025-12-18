'use client'

/**
 * PlannerOverlay - Product placement markers using HTML/SVG overlays
 *
 * Uses CAMERA_CHANGE_EVENT to update marker positions during pan/zoom.
 * This is more reliable than THREE.js scene manipulation for 2D views.
 *
 * Handles:
 * - Drag & drop for placing new products
 * - Click detection for marker selection
 * - Visual marker rendering with selection state
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LegacyPlacement, DragProductData } from './types'

// Debug flag
const DEBUG = true
const log = (...args: unknown[]) => DEBUG && console.log('[PlannerOverlay]', ...args)

// Marker constants
const MARKER_SIZE = 24 // pixels

interface MarkerScreenPos {
  id: string
  x: number
  y: number
  visible: boolean
}

/**
 * @deprecated Use PlannerMarkups instead - this component doesn't work with 2D pan/zoom
 */
interface PlannerOverlayProps {
  placements: LegacyPlacement[]
  onPlacementAdd: (placement: Omit<LegacyPlacement, 'id'>) => void
  onPlacementSelect: (id: string | null) => void
  onPlacementMove: (id: string, worldX: number, worldY: number) => void
  onPlacementDelete: (id: string) => void
  selectedId: string | null
  className?: string
}

export function PlannerOverlay({
  placements,
  onPlacementAdd,
  onPlacementSelect,
  onPlacementMove,
  onPlacementDelete,
  selectedId,
  className,
}: PlannerOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null)
  const [markerPositions, setMarkerPositions] = useState<MarkerScreenPos[]>([])

  // Calculate screen positions for all markers using orthographic camera math
  const updateMarkerPositions = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nopViewer = (window as any).NOP_VIEWER
    if (!nopViewer) {
      log('Viewer not available')
      return
    }

    const impl = nopViewer.impl
    const camera = impl?.camera
    const container = nopViewer.container

    if (!camera || !container) {
      log('Camera or container not available')
      return
    }

    const rect = container.getBoundingClientRect()
    const newPositions: MarkerScreenPos[] = []

    // Get orthographic camera frustum bounds
    const { left, right, top, bottom } = camera
    const frustumWidth = right - left
    const frustumHeight = top - bottom

    // Get camera position (center of view in world coords)
    const camX = camera.position.x
    const camY = camera.position.y

    for (const placement of placements) {
      try {
        // Manual orthographic projection:
        // 1. Transform world position relative to camera center
        const relX = placement.worldX - camX
        const relY = placement.worldY - camY

        // 2. Normalize to [-0.5, 0.5] range based on frustum
        const normX = relX / frustumWidth
        const normY = relY / frustumHeight

        // 3. Convert to screen coordinates (Y is inverted in screen space)
        const x = (normX + 0.5) * rect.width
        const y = (0.5 - normY) * rect.height

        // Check if within container bounds
        const visible = x >= -MARKER_SIZE && x <= rect.width + MARKER_SIZE &&
                       y >= -MARKER_SIZE && y <= rect.height + MARKER_SIZE

        newPositions.push({
          id: placement.id,
          x,
          y,
          visible,
        })

        log('Marker', placement.id, 'world:', placement.worldX.toFixed(1), placement.worldY.toFixed(1),
            'screen:', x.toFixed(1), y.toFixed(1),
            'cam:', camX.toFixed(1), camY.toFixed(1),
            'frustum:', frustumWidth.toFixed(1), frustumHeight.toFixed(1))
      } catch (e) {
        log('Error computing position:', e)
      }
    }

    setMarkerPositions(newPositions)
  }, [placements])

  // Listen to camera changes to update marker positions
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nopViewer = (window as any).NOP_VIEWER
    if (!nopViewer) {
      log('Waiting for viewer...')
      // Check again in 500ms
      const timer = setTimeout(() => {
        updateMarkerPositions()
      }, 500)
      return () => clearTimeout(timer)
    }

    // Initial position update
    updateMarkerPositions()

    // Listen to camera changes
    const handleCameraChange = () => {
      updateMarkerPositions()
    }

    // Try different event names for camera changes
    const CAMERA_CHANGE_EVENT = window.Autodesk?.Viewing?.CAMERA_CHANGE_EVENT || 'cameraChanged'

    log('Setting up camera change listener:', CAMERA_CHANGE_EVENT)
    nopViewer.addEventListener(CAMERA_CHANGE_EVENT, handleCameraChange)

    // Also listen to other potential events that might indicate view changes
    nopViewer.addEventListener('viewerTransformationChange', handleCameraChange)

    // Use RAF for smooth updates during continuous pan/zoom
    let rafId: number | null = null
    const rafUpdate = () => {
      updateMarkerPositions()
      rafId = requestAnimationFrame(rafUpdate)
    }
    rafId = requestAnimationFrame(rafUpdate)

    return () => {
      nopViewer.removeEventListener(CAMERA_CHANGE_EVENT, handleCameraChange)
      nopViewer.removeEventListener('viewerTransformationChange', handleCameraChange)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [updateMarkerPositions])

  // Update positions when placements change
  useEffect(() => {
    updateMarkerPositions()
  }, [placements, updateMarkerPositions])

  // Handle clicks on viewer for marker selection
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (isDragging || isDragOver) return

    // Check if click was on a marker
    const target = e.target as HTMLElement
    if (target.closest('[data-marker-id]')) {
      return // Let marker handle its own click
    }

    // Click on empty area - deselect
    onPlacementSelect(null)
  }, [isDragging, isDragOver, onPlacementSelect])

  // Detect global drag start/end
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('application/json')) {
        setIsDragging(true)
      }
    }

    const handleDragEnd = () => {
      setIsDragging(false)
      setIsDragOver(false)
      setDragPreview(null)
    }

    document.addEventListener('dragstart', handleDragStart)
    document.addEventListener('dragend', handleDragEnd)

    return () => {
      document.removeEventListener('dragstart', handleDragStart)
      document.removeEventListener('dragend', handleDragEnd)
    }
  }, [])

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)

    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setDragPreview({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }, [])

  // Handle drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const x = e.clientX
      const y = e.clientY
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        setIsDragOver(false)
        setDragPreview(null)
      }
    }
  }, [])

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    setDragPreview(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nopViewer = (window as any).NOP_VIEWER
    if (!nopViewer?.impl?.intersectGround) return

    // Convert to world coordinates
    const worldPos = nopViewer.impl.intersectGround(e.clientX, e.clientY)
    if (!worldPos) return

    // Get the dragged product data
    try {
      const dataStr = e.dataTransfer.getData('application/json')
      if (!dataStr) return

      const data: DragProductData = JSON.parse(dataStr)
      log('Drop:', data.fossPid, 'at', worldPos.x, worldPos.y)

      onPlacementAdd({
        productId: data.productId,
        projectProductId: data.projectProductId,
        productName: data.fossPid || data.description,
        worldX: worldPos.x,
        worldY: worldPos.y,
        rotation: 0,
      })
    } catch {
      // Ignore parse errors
    }
  }, [onPlacementAdd])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
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

  return (
    <div
      ref={containerRef}
      className={cn('absolute inset-0', className)}
      onClick={handleOverlayClick}
      style={{ pointerEvents: isDragging ? 'auto' : 'none' }}
    >
      {/* Drop zone - only active when dragging */}
      {isDragging && (
        <div
          className={cn(
            'absolute inset-0 transition-colors pointer-events-auto',
            isDragOver ? 'bg-primary/10' : 'bg-transparent'
          )}
          style={{ zIndex: 99 }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragOver && dragPreview && (
            <div
              className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary border-dashed bg-primary/20"
              style={{ left: dragPreview.x, top: dragPreview.y }}
            />
          )}
        </div>
      )}

      {/* Markers rendered as HTML elements */}
      {!isDragging && markerPositions.map((pos) => {
        if (!pos.visible) return null
        const isSelected = pos.id === selectedId
        const placement = placements.find(p => p.id === pos.id)

        return (
          <div
            key={pos.id}
            data-marker-id={pos.id}
            className={cn(
              'absolute cursor-pointer transition-transform',
              isSelected ? 'z-50' : 'z-40'
            )}
            style={{
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onPlacementSelect(pos.id)
            }}
          >
            {/* Marker circle */}
            <div
              className={cn(
                'w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors',
                isSelected
                  ? 'bg-amber-500 border-amber-600 text-white scale-110'
                  : 'bg-blue-500 border-blue-600 text-white hover:scale-105'
              )}
              title={placement?.productName}
            >
              {/* Optional: Show index or icon */}
            </div>

            {/* Delete button for selected marker */}
            {isSelected && (
              <button
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg border border-background"
                onClick={(e) => {
                  e.stopPropagation()
                  onPlacementDelete(pos.id)
                }}
                title="Delete marker (Del)"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
