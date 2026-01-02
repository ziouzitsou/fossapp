'use client'

import { useParams, usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useMemo } from 'react'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { CaseStudyToolbar } from '../components'
import { useCaseStudyState, useViewerControls } from '../hooks'
import type { CaseStudyStateValue, ViewerControlsValue } from '../hooks'
import type { ViewMode } from '../types'

// ============================================================================
// CONTEXT - Share state between shell and child pages
// ============================================================================

interface CaseStudyContextValue {
  state: CaseStudyStateValue
  viewerControls: ViewerControlsValue
  areaCode: string
  viewMode: ViewMode
}

const CaseStudyContext = createContext<CaseStudyContextValue | null>(null)

export function useCaseStudyContext() {
  const ctx = useContext(CaseStudyContext)
  if (!ctx) {
    throw new Error('useCaseStudyContext must be used within CaseStudyShell')
  }
  return ctx
}

// ============================================================================
// SHELL (Client Component)
// ============================================================================

export function CaseStudyShell({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()

  const areaCode = params.areaCode as string
  const state = useCaseStudyState()
  const viewerControls = useViewerControls()

  // Derive view mode from URL
  const viewMode: ViewMode = pathname.endsWith('/viewer') ? 'viewer' : 'products'

  // Find area by code (case-insensitive)
  const selectedArea = useMemo(() => {
    return state.areas.find(
      (a) => a.areaCode.toLowerCase() === areaCode.toLowerCase()
    )
  }, [state.areas, areaCode])

  // Handle area change - navigate to new URL
  const handleAreaChange = (areaId: string) => {
    const area = state.areas.find((a) => a.id === areaId)
    if (area) {
      router.push(`/case-study/${area.areaCode.toLowerCase()}/${viewMode}`)
    }
  }

  // Handle view mode change - navigate to new URL
  const handleViewModeChange = (mode: ViewMode) => {
    router.push(`/case-study/${areaCode.toLowerCase()}/${mode}`)
  }

  // Context value
  const contextValue: CaseStudyContextValue = {
    state,
    viewerControls,
    areaCode,
    viewMode,
  }

  return (
    <CaseStudyContext.Provider value={contextValue}>
      <ProtectedPageLayout>
        <div className="flex h-full flex-col">
          {/* Toolbar - always visible */}
          <CaseStudyToolbar
            areas={state.areas}
            selectedAreaId={selectedArea?.id ?? state.areas[0]?.id ?? ''}
            onAreaChange={handleAreaChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />

          {/* Child route content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </ProtectedPageLayout>
    </CaseStudyContext.Provider>
  )
}
