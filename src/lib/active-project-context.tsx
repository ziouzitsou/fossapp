'use client'

/**
 * Active Project Context - Backward Compatibility Layer
 *
 * This module now delegates to UserSettingsProvider for cross-device sync.
 * Existing imports continue to work unchanged.
 *
 * @deprecated Use useUserSettings() from '@/lib/user-settings-context' directly
 */

import { useUserSettings } from './user-settings-context'

export interface ActiveProject {
  id: string
  project_code: string
  name: string
}

/**
 * @deprecated Use useUserSettings() or useActiveProjectSettings() from '@/lib/user-settings-context'
 */
export function useActiveProject() {
  const { activeProject, setActiveProject } = useUserSettings()

  return {
    activeProject,
    setActiveProject,
    clearActiveProject: () => setActiveProject(null),
    isActive: (projectId: string) => activeProject?.id === projectId,
  }
}

/**
 * @deprecated ActiveProjectProvider is no longer needed.
 * UserSettingsProvider in providers.tsx handles active project management.
 * This component is kept for backward compatibility but does nothing.
 */
export function ActiveProjectProvider({ children }: { children: React.ReactNode }) {
  // No-op - UserSettingsProvider handles active project now
  return <>{children}</>
}
