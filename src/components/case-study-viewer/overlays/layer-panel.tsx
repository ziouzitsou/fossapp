'use client'

/**
 * LayerPanel - Layer visibility controls in viewer bottom-left
 *
 * Provides AutoCAD-style layer visibility toggles similar to the
 * Autodesk Viewer's GUI layer panel. Shows a list of layers with
 * eye icons to toggle visibility.
 */

import { useState } from 'react'
import { Layers, Eye, EyeOff } from 'lucide-react'
import { cn, Button, Popover, PopoverContent, PopoverTrigger } from '@fossapp/ui'

/**
 * Layer information from APS Viewer model data
 */
export interface LayerInfo {
  /** Layer name from AutoCAD */
  name: string
  /** Internal layer ID */
  id: number
  /** Layer index */
  index: number
  /** Whether this is a layer (vs folder) */
  isLayer: boolean
}

export interface LayerPanelProps {
  /** List of layers from the DWG */
  layers: LayerInfo[]
  /** Map of layer name to visibility state */
  layerVisibility: Record<string, boolean>
  /** Callback when layer visibility is toggled */
  onToggleLayer: (layer: LayerInfo) => void
  /** Callback to show all layers */
  onShowAll: () => void
  /** Callback to hide all layers */
  onHideAll: () => void
}

/**
 * LayerPanel - Layer visibility controls
 */
export function LayerPanel({
  layers,
  layerVisibility,
  onToggleLayer,
  onShowAll,
  onHideAll,
}: LayerPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Count visible/hidden layers
  const visibleCount = Object.values(layerVisibility).filter(Boolean).length
  const hiddenCount = layers.length - visibleCount
  const hasHiddenLayers = hiddenCount > 0

  return (
    <div className="absolute bottom-3 left-3 z-20">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-8 w-8 bg-background/85 backdrop-blur-sm border-border/50 shadow-sm hover:bg-accent relative',
              hasHiddenLayers && 'border-amber-500/50'
            )}
            title={`Layers (${visibleCount}/${layers.length} visible)`}
          >
            <Layers className={cn('h-4 w-4', hasHiddenLayers && 'text-amber-500')} />
            {hasHiddenLayers && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center">
                {hiddenCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-0"
          align="start"
          side="top"
          sideOffset={8}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Layers</span>
              <span className="text-xs text-muted-foreground">
                ({visibleCount}/{layers.length})
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onShowAll}
                title="Show all layers"
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onHideAll}
                title="Hide all layers"
              >
                None
              </Button>
            </div>
          </div>

          {/* Layer list */}
          <div className="max-h-64 overflow-y-auto">
            {layers.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No layers found
              </div>
            ) : (
              <ul className="py-1">
                {layers.map((layer) => {
                  const isVisible = layerVisibility[layer.name] ?? true
                  return (
                    <li key={layer.id}>
                      <button
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors',
                          !isVisible && 'text-muted-foreground'
                        )}
                        onClick={() => onToggleLayer(layer)}
                      >
                        {isVisible ? (
                          <Eye className="h-3.5 w-3.5 text-primary shrink-0" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className={cn('truncate', !isVisible && 'line-through')}>
                          {layer.name}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
