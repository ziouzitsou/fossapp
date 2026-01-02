'use client'

import { useParams, usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { useUserSettings } from '@/lib/user-settings-context'
import { Skeleton } from '@fossapp/ui'
import { getCaseStudyAreasAction } from '../actions'
import { getUserPreferencesAction } from '@/lib/actions/user-preferences'
import { DEFAULT_VIEW_PREFERENCES, type ViewPreferences } from '@/lib/actions/user-preferences-types'
import { CaseStudyToolbar } from '../components'
import { useCaseStudyState, useViewerControls, useFloorPlanUpload } from '../hooks'
import type { CaseStudyStateValue, ViewerControlsValue, FloorPlanUploadValue } from '../hooks'
import type { CaseStudyArea, ViewMode } from '../types'

// ============================================================================
// CONTEXT - Share state between shell and child pages
// ============================================================================

interface CaseStudyContextValue {
  state: CaseStudyStateValue
  viewerControls: ViewerControlsValue
  floorPlanUpload: FloorPlanUploadValue
  viewPreferences: ViewPreferences
  areas: CaseStudyArea[]
  selectedArea: CaseStudyArea | null
  areaCode: string
  viewMode: ViewMode
  isLoadingAreas: boolean
  projectError: string | null
  projectId: string | null
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
// NO PROJECT SELECTED STATE
// ============================================================================

function NoProjectSelected() {
  const router = useRouter()

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-semibold">No Project Selected</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Please select a project from the Projects page to view its case study.
        </p>
        <button
          onClick={() => router.push('/projects')}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 rounded-md px-4 py-2"
        >
          Go to Projects
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// SHELL (Client Component)
// ============================================================================

export function CaseStudyShell({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { activeProject } = useUserSettings()

  const areaCode = params.areaCode as string

  // Areas state - fetched from project
  const [areas, setAreas] = useState<CaseStudyArea[]>([])
  const [isLoadingAreas, setIsLoadingAreas] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)

  // View preferences state
  const [viewPreferences, setViewPreferences] = useState<ViewPreferences>(DEFAULT_VIEW_PREFERENCES)

  // Load user preferences
  useEffect(() => {
    const email = session?.user?.email
    if (!email) return

    async function loadPreferences() {
      try {
        const result = await getUserPreferencesAction(email as string)
        if (result.success && result.data) {
          setViewPreferences({
            ...DEFAULT_VIEW_PREFERENCES,
            ...result.data.view_preferences,
          })
        }
      } catch (err) {
        console.error('Failed to load user preferences:', err)
      }
    }

    loadPreferences()
  }, [session?.user?.email])

  // Fetch areas when project changes
  useEffect(() => {
    if (!activeProject?.id) {
      setAreas([])
      setProjectError(null)
      return
    }

    // Capture project ID for use in async function (ensures type narrowing)
    const projectId = activeProject.id
    let cancelled = false

    async function fetchAreas() {
      setIsLoadingAreas(true)
      setProjectError(null)

      try {
        const result = await getCaseStudyAreasAction(projectId)

        if (cancelled) return

        if (!result.success) {
          setProjectError(result.error || 'Failed to fetch areas')
          return
        }

        setAreas(result.data || [])

        // If current areaCode doesn't match any area, redirect to first area
        if (result.data && result.data.length > 0) {
          const matchingArea = result.data.find(
            (a) => a.areaCode.toLowerCase() === areaCode.toLowerCase()
          )
          if (!matchingArea) {
            const firstArea = result.data[0]
            router.replace(
              `/case-study/${firstArea.areaCode.toLowerCase()}/products`
            )
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch areas:', err)
          setProjectError('An unexpected error occurred')
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAreas(false)
        }
      }
    }

    fetchAreas()

    return () => {
      cancelled = true
    }
  }, [activeProject?.id, areaCode, router])

  // Derive view mode from URL
  const viewMode: ViewMode = pathname.endsWith('/viewer') ? 'viewer' : 'products'

  // Find selected area by code (case-insensitive)
  const selectedArea = useMemo(() => {
    return (
      areas.find((a) => a.areaCode.toLowerCase() === areaCode.toLowerCase()) ||
      null
    )
  }, [areas, areaCode])

  // State hook - pass selected area's revision ID
  const state = useCaseStudyState(selectedArea?.revisionId ?? null)
  const viewerControls = useViewerControls()
  const floorPlanUpload = useFloorPlanUpload(selectedArea, activeProject?.id ?? null)

  // Handle area change - navigate to new URL
  const handleAreaChange = (areaId: string) => {
    const area = areas.find((a) => a.id === areaId)
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
    floorPlanUpload,
    viewPreferences,
    areas,
    selectedArea,
    areaCode,
    viewMode,
    isLoadingAreas,
    projectError,
    projectId: activeProject?.id ?? null,
  }

  // Show loading state
  if (!activeProject) {
    return (
      <ProtectedPageLayout>
        <NoProjectSelected />
      </ProtectedPageLayout>
    )
  }

  // Show loading skeleton while fetching areas
  if (isLoadingAreas && areas.length === 0) {
    return (
      <ProtectedPageLayout>
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <Skeleton className="h-10 w-64" />
          </div>
          <div className="flex-1 p-4">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      </ProtectedPageLayout>
    )
  }

  // Show error state
  if (projectError) {
    return (
      <ProtectedPageLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-600">Error</h2>
            <p className="text-muted-foreground mt-2">{projectError}</p>
          </div>
        </div>
      </ProtectedPageLayout>
    )
  }

  // Show empty state if no areas
  if (areas.length === 0) {
    return (
      <ProtectedPageLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold">No Areas Found</h2>
            <p className="text-muted-foreground mt-2 max-w-md">
              This project has no areas yet. Please create an area first.
            </p>
            <button
              onClick={() =>
                router.push(`/projects/${activeProject.id}?tab=areas`)
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 rounded-md px-4 py-2"
            >
              Manage Areas
            </button>
          </div>
        </div>
      </ProtectedPageLayout>
    )
  }

  return (
    <CaseStudyContext.Provider value={contextValue}>
      <ProtectedPageLayout>
        <div className="flex h-full flex-col">
          {/* Hidden file input for DWG upload */}
          <input
            ref={floorPlanUpload.fileInputRef}
            type="file"
            accept=".dwg"
            onChange={floorPlanUpload.handleFileChange}
            className="hidden"
            aria-label="Upload DWG floor plan"
          />

          {/* Toolbar - always visible */}
          <CaseStudyToolbar
            areas={areas}
            selectedAreaId={selectedArea?.id ?? areas[0]?.id ?? ''}
            onAreaChange={handleAreaChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onUploadClick={floorPlanUpload.triggerFileSelect}
            isUploading={floorPlanUpload.isUploading}
            hasFloorPlan={floorPlanUpload.hasExistingFloorPlan}
            floorPlanFilename={floorPlanUpload.existingFilename}
          />

          {/* Upload error toast */}
          {floorPlanUpload.uploadError && (
            <div className="bg-destructive/10 text-destructive border-destructive/20 mx-4 mt-2 rounded-md border px-4 py-2 text-sm">
              {floorPlanUpload.uploadError}
            </div>
          )}

          {/* Child route content */}
          <div className="flex-1 overflow-hidden">{children}</div>
        </div>
      </ProtectedPageLayout>
    </CaseStudyContext.Provider>
  )
}
