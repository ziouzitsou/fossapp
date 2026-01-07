'use client'

import { ViewerView } from '../../components/viewer-view'
import { useCaseStudyContext } from '../case-study-shell'

/**
 * Viewer Page
 * Route: /case-study/[areaCode]/viewer
 *
 * DWG viewer with pick-and-place functionality.
 */
export default function ViewerPage() {
  const {
    state,
    viewerControls,
    floorPlanUpload,
    viewPreferences,
    selectedArea,
    projectId,
  } = useCaseStudyContext()

  return (
    <ViewerView
      luminaires={state.luminaires}
      placements={state.placements}
      viewerControls={viewerControls}
      floorPlanUpload={floorPlanUpload}
      projectId={projectId}
      areaRevisionId={selectedArea?.revisionId ?? null}
      viewerBgTopColor={viewPreferences.viewer_bg_top_color}
      viewerBgBottomColor={viewPreferences.viewer_bg_bottom_color}
      markerMinScreenPx={viewPreferences.marker_min_screen_px}
      reverseZoomDirection={viewPreferences.reverse_zoom_direction}
      onAddPlacement={state.addPlacement}
      onRemovePlacement={state.removePlacement}
      onRotatePlacement={state.updatePlacementRotation}
      onMovePlacement={(id, worldX, worldY) => state.updatePlacementPosition(id, { x: worldX, y: worldY })}
      onRefresh={state.refetchProducts}
      isRefreshing={state.isLoading}
      hiddenSymbolGroups={state.hiddenSymbolGroups}
      toggleSymbolGroupVisibility={state.toggleSymbolGroupVisibility}
    />
  )
}
