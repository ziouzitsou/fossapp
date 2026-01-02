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
  const { state, viewerControls } = useCaseStudyContext()

  return (
    <ViewerView
      luminaires={state.luminaires}
      placements={state.placements}
      viewerControls={viewerControls}
      onAddPlacement={state.addPlacement}
      onRemovePlacement={state.removePlacement}
    />
  )
}
