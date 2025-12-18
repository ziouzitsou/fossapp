'use client'

/**
 * PlannerMarker - SVG marker for a placed product
 *
 * Renders a circular marker with product identifier.
 * Shows selection state and provides delete action.
 */

import { memo } from 'react'
import type { Placement } from './types'

interface PlannerMarkerProps {
  placement: Placement
  x: number
  y: number
  size: number
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

export const PlannerMarker = memo(function PlannerMarker({
  placement,
  x,
  y,
  size,
  isSelected,
  onSelect,
  onDelete,
}: PlannerMarkerProps) {
  const radius = size / 2

  // Get initials or short code for display
  const getLabel = () => {
    const name = placement.productName
    if (name.length <= 3) return name
    // For FOSS PIDs like "ZL-123", show first part
    if (name.includes('-')) {
      return name.split('-')[0]
    }
    // Otherwise show first 2-3 characters
    return name.substring(0, 2).toUpperCase()
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect()
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Could open edit dialog in future
  }

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${placement.rotation})`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
    >
      {/* Selection ring */}
      {isSelected && (
        <circle
          r={radius + 4}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeDasharray="4 2"
          className="animate-pulse"
        />
      )}

      {/* Main marker circle */}
      <circle
        r={radius}
        fill={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--secondary))'}
        stroke={isSelected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--border))'}
        strokeWidth={2}
      />

      {/* Label text */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill={isSelected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))'}
        fontSize={size * 0.4}
        fontWeight="600"
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {getLabel()}
      </text>

      {/* Delete button (only when selected) */}
      {isSelected && (
        <g
          transform={`translate(${radius}, ${-radius})`}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
        >
          <circle
            r={8}
            fill="hsl(var(--destructive))"
            stroke="hsl(var(--background))"
            strokeWidth={2}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill="hsl(var(--destructive-foreground))"
            fontSize={10}
            fontWeight="bold"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            x
          </text>
        </g>
      )}

      {/* Tooltip on hover */}
      <title>{placement.productName}</title>
    </g>
  )
})
