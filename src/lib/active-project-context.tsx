'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

export interface ActiveProject {
  id: string
  project_code: string
  name: string
}

interface ActiveProjectContextType {
  activeProject: ActiveProject | null
  setActiveProject: (project: ActiveProject | null) => void
  clearActiveProject: () => void
  isActive: (projectId: string) => boolean
}

const STORAGE_KEY = 'fossapp-active-project'

const ActiveProjectContext = createContext<ActiveProjectContextType | undefined>(undefined)

export function ActiveProjectProvider({ children }: { children: React.ReactNode }) {
  const [activeProject, setActiveProjectState] = useState<ActiveProject | null>(null)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ActiveProject
        // Validate the stored data has required fields
        if (parsed.id && parsed.project_code && parsed.name) {
          setActiveProjectState(parsed)
        }
      }
    } catch (error) {
      console.error('Failed to load active project from storage:', error)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const setActiveProject = useCallback((project: ActiveProject | null) => {
    setActiveProjectState(project)
    if (project) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const clearActiveProject = useCallback(() => {
    setActiveProjectState(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const isActive = useCallback((projectId: string) => {
    return activeProject?.id === projectId
  }, [activeProject])

  // Prevent hydration mismatch by not rendering until mounted
  // But still provide context so children don't error
  return (
    <ActiveProjectContext.Provider
      value={{
        activeProject: mounted ? activeProject : null,
        setActiveProject,
        clearActiveProject,
        isActive,
      }}
    >
      {children}
    </ActiveProjectContext.Provider>
  )
}

export function useActiveProject() {
  const context = useContext(ActiveProjectContext)
  if (context === undefined) {
    throw new Error('useActiveProject must be used within ActiveProjectProvider')
  }
  return context
}
