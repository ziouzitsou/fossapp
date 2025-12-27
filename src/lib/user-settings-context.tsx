'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useDevSession } from '@/lib/use-dev-session'
import {
  getUserSettingsAction,
  updateUserSettingsAction,
  type UpdateSettingsInput,
} from '@/lib/actions/user-settings'

// ============================================================================
// TYPES
// ============================================================================

type Theme = 'default' | 'minimal' | 'emerald' | 'ocean'

interface ActiveProject {
  id: string
  project_code: string
  name: string
}

interface UserSettingsContextType {
  // Status
  isLoading: boolean
  isSyncing: boolean
  isAuthenticated: boolean

  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void

  // Sidebar
  sidebarExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void

  // Active Project
  activeProject: ActiveProject | null
  setActiveProject: (project: ActiveProject | null) => void

  // Last Seen Version (for What's New dialog)
  lastSeenVersion: string | null
  setLastSeenVersion: (version: string) => void

  // Search Histories
  searchHistoryTiles: string[]
  searchHistorySymbols: string[]
  searchHistoryCustomers: string[]
  addToSearchHistory: (type: 'tiles' | 'symbols' | 'customers', term: string) => void
  clearSearchHistory: (type: 'tiles' | 'symbols' | 'customers') => void

  // Force sync
  syncNow: () => Promise<void>
}

// Local storage keys (fallback for unauthenticated users)
const STORAGE_KEYS = {
  theme: 'app-theme',
  sidebar: 'sidebar_state',
  activeProject: 'fossapp-active-project',
  lastSeenVersion: 'fossapp_last_seen_version',
  searchTiles: 'tiles-search-history',
  searchSymbols: 'symbol-generator-search-history',
  searchCustomers: 'customerSearchHistory',
}

// ============================================================================
// CONTEXT
// ============================================================================

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined)

// ============================================================================
// PROVIDER
// ============================================================================

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useDevSession()
  const isAuthenticated = status === 'authenticated' && !!session?.user?.email

  // State
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Settings state
  const [theme, setThemeState] = useState<Theme>('default')
  const [sidebarExpanded, setSidebarExpandedState] = useState(true)
  const [activeProject, setActiveProjectState] = useState<ActiveProject | null>(null)
  const [lastSeenVersion, setLastSeenVersionState] = useState<string | null>(null)
  const [searchHistoryTiles, setSearchHistoryTiles] = useState<string[]>([])
  const [searchHistorySymbols, setSearchHistorySymbols] = useState<string[]>([])
  const [searchHistoryCustomers, setSearchHistoryCustomers] = useState<string[]>([])

  // Debounce timer ref
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingUpdatesRef = useRef<UpdateSettingsInput>({})

  // ============================================================================
  // LOAD FROM LOCAL STORAGE (Initial + Fallback)
  // ============================================================================

  const loadFromLocalStorage = useCallback(() => {
    try {
      // Theme
      const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) as Theme | null
      if (savedTheme && ['default', 'minimal', 'emerald', 'ocean'].includes(savedTheme)) {
        setThemeState(savedTheme)
      }

      // Sidebar (from cookie)
      const sidebarCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('sidebar_state='))
      if (sidebarCookie) {
        setSidebarExpandedState(sidebarCookie.split('=')[1] === 'true')
      }

      // Active Project
      const savedProject = localStorage.getItem(STORAGE_KEYS.activeProject)
      if (savedProject) {
        const parsed = JSON.parse(savedProject)
        if (parsed.id && parsed.project_code && parsed.name) {
          setActiveProjectState(parsed)
        }
      }

      // Last Seen Version
      const savedVersion = localStorage.getItem(STORAGE_KEYS.lastSeenVersion)
      if (savedVersion) {
        setLastSeenVersionState(savedVersion)
      }

      // Search Histories
      const savedTiles = localStorage.getItem(STORAGE_KEYS.searchTiles)
      if (savedTiles) {
        setSearchHistoryTiles(JSON.parse(savedTiles))
      }

      const savedSymbols = localStorage.getItem(STORAGE_KEYS.searchSymbols)
      if (savedSymbols) {
        setSearchHistorySymbols(JSON.parse(savedSymbols))
      }

      const savedCustomers = localStorage.getItem(STORAGE_KEYS.searchCustomers)
      if (savedCustomers) {
        setSearchHistoryCustomers(JSON.parse(savedCustomers))
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error)
    }
  }, [])

  // ============================================================================
  // SAVE TO LOCAL STORAGE (Always, for instant feedback)
  // ============================================================================

  const saveToLocalStorage = useCallback((updates: UpdateSettingsInput) => {
    try {
      if (updates.theme !== undefined) {
        localStorage.setItem(STORAGE_KEYS.theme, updates.theme)
      }
      if (updates.sidebar_expanded !== undefined) {
        document.cookie = `sidebar_state=${updates.sidebar_expanded}; path=/; max-age=604800`
      }
      if (updates.active_project_id !== undefined) {
        if (updates.active_project_id === null) {
          localStorage.removeItem(STORAGE_KEYS.activeProject)
        } else {
          localStorage.setItem(STORAGE_KEYS.activeProject, JSON.stringify({
            id: updates.active_project_id,
            project_code: updates.active_project_code,
            name: updates.active_project_name,
          }))
        }
      }
      if (updates.last_seen_version !== undefined) {
        if (updates.last_seen_version) {
          localStorage.setItem(STORAGE_KEYS.lastSeenVersion, updates.last_seen_version)
        }
      }
      if (updates.search_history_tiles !== undefined) {
        localStorage.setItem(STORAGE_KEYS.searchTiles, JSON.stringify(updates.search_history_tiles))
      }
      if (updates.search_history_symbols !== undefined) {
        localStorage.setItem(STORAGE_KEYS.searchSymbols, JSON.stringify(updates.search_history_symbols))
      }
      if (updates.search_history_customers !== undefined) {
        localStorage.setItem(STORAGE_KEYS.searchCustomers, JSON.stringify(updates.search_history_customers))
      }
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error)
    }
  }, [])

  // ============================================================================
  // SYNC TO DATABASE (Debounced)
  // ============================================================================

  const syncToDatabase = useCallback(async (updates: UpdateSettingsInput) => {
    if (!isAuthenticated || !session?.user?.email) return

    // Merge with pending updates
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates }

    // Clear existing timer
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current)
    }

    // Set new timer (300ms debounce)
    syncTimerRef.current = setTimeout(async () => {
      const updatesToSync = { ...pendingUpdatesRef.current }
      pendingUpdatesRef.current = {}

      if (Object.keys(updatesToSync).length === 0) return

      setIsSyncing(true)
      try {
        await updateUserSettingsAction(session.user!.email!, updatesToSync)
      } catch (error) {
        console.error('Failed to sync settings to database:', error)
      } finally {
        setIsSyncing(false)
      }
    }, 300)
  }, [isAuthenticated, session?.user?.email])

  // ============================================================================
  // LOAD FROM DATABASE (On Auth)
  // ============================================================================

  const loadFromDatabase = useCallback(async () => {
    if (!session?.user?.email) return

    try {
      const result = await getUserSettingsAction(session.user.email)

      if (result.success && result.data) {
        const settings = result.data

        // Apply DB settings (DB wins over localStorage)
        if (settings.theme) {
          setThemeState(settings.theme as Theme)
          localStorage.setItem(STORAGE_KEYS.theme, settings.theme)
        }

        if (settings.sidebar_expanded !== null) {
          setSidebarExpandedState(settings.sidebar_expanded)
          document.cookie = `sidebar_state=${settings.sidebar_expanded}; path=/; max-age=604800`
        }

        if (settings.active_project_id) {
          const project = {
            id: settings.active_project_id,
            project_code: settings.active_project_code || '',
            name: settings.active_project_name || '',
          }
          setActiveProjectState(project)
          localStorage.setItem(STORAGE_KEYS.activeProject, JSON.stringify(project))
        }

        if (settings.last_seen_version) {
          setLastSeenVersionState(settings.last_seen_version)
          localStorage.setItem(STORAGE_KEYS.lastSeenVersion, settings.last_seen_version)
        }

        if (settings.search_history_tiles?.length) {
          setSearchHistoryTiles(settings.search_history_tiles)
          localStorage.setItem(STORAGE_KEYS.searchTiles, JSON.stringify(settings.search_history_tiles))
        }

        if (settings.search_history_symbols?.length) {
          setSearchHistorySymbols(settings.search_history_symbols)
          localStorage.setItem(STORAGE_KEYS.searchSymbols, JSON.stringify(settings.search_history_symbols))
        }

        if (settings.search_history_customers?.length) {
          setSearchHistoryCustomers(settings.search_history_customers)
          localStorage.setItem(STORAGE_KEYS.searchCustomers, JSON.stringify(settings.search_history_customers))
        }
      }
    } catch (error) {
      console.error('Failed to load settings from database:', error)
    }
  }, [session?.user?.email])

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  // Mount and load from localStorage first (instant)
  useEffect(() => {
    setMounted(true)
    loadFromLocalStorage()
    setIsLoading(false)
  }, [loadFromLocalStorage])

  // Track if we've already synced this session to prevent infinite loops
  const hasSyncedRef = useRef(false)

  // When authenticated, load from DB or migrate localStorage to DB (runs once per auth)
  useEffect(() => {
    if (mounted && isAuthenticated && session?.user?.email && !hasSyncedRef.current) {
      hasSyncedRef.current = true

      const migrateLocalSettingsToDb = async () => {
        // Get current local values at time of migration
        const currentTheme = localStorage.getItem(STORAGE_KEYS.theme) as Theme | null || 'default'
        const currentProject = localStorage.getItem(STORAGE_KEYS.activeProject)
        const currentVersion = localStorage.getItem(STORAGE_KEYS.lastSeenVersion)
        const currentTiles = localStorage.getItem(STORAGE_KEYS.searchTiles)
        const currentSymbols = localStorage.getItem(STORAGE_KEYS.searchSymbols)
        const currentCustomers = localStorage.getItem(STORAGE_KEYS.searchCustomers)

        // First, get current DB settings
        const result = await getUserSettingsAction(session.user!.email!)

        if (result.success && result.data) {
          const dbSettings = result.data

          // Check if DB has only defaults (never been synced)
          const dbIsDefault =
            dbSettings.theme === 'default' &&
            !dbSettings.active_project_id &&
            !dbSettings.last_seen_version &&
            (!dbSettings.search_history_tiles || dbSettings.search_history_tiles.length === 0) &&
            (!dbSettings.search_history_symbols || dbSettings.search_history_symbols.length === 0) &&
            (!dbSettings.search_history_customers || dbSettings.search_history_customers.length === 0)

          // Check if localStorage has any non-default values
          const localHasValues =
            (currentTheme && currentTheme !== 'default') ||
            currentProject !== null ||
            currentVersion !== null ||
            (currentTiles && JSON.parse(currentTiles).length > 0) ||
            (currentSymbols && JSON.parse(currentSymbols).length > 0) ||
            (currentCustomers && JSON.parse(currentCustomers).length > 0)

          if (dbIsDefault && localHasValues) {
            // Migrate localStorage → DB (one-time)
            console.log('[UserSettings] Migrating local settings to database')
            const parsedProject = currentProject ? JSON.parse(currentProject) : null
            await updateUserSettingsAction(session.user!.email!, {
              theme: currentTheme,
              sidebar_expanded: sidebarExpanded,
              active_project_id: parsedProject?.id || null,
              active_project_code: parsedProject?.project_code || null,
              active_project_name: parsedProject?.name || null,
              last_seen_version: currentVersion,
              search_history_tiles: currentTiles ? JSON.parse(currentTiles) : [],
              search_history_symbols: currentSymbols ? JSON.parse(currentSymbols) : [],
              search_history_customers: currentCustomers ? JSON.parse(currentCustomers) : [],
            })
          } else if (!dbIsDefault) {
            // DB has values, apply them (DB wins)
            loadFromDatabase()
          }
        } else {
          // Couldn't get DB settings, just load from localStorage
          console.log('[UserSettings] Could not fetch DB settings, using localStorage')
        }
      }

      migrateLocalSettingsToDb()
    }
  }, [mounted, isAuthenticated, session?.user?.email, loadFromDatabase, sidebarExpanded])

  // ============================================================================
  // APPLY THEME CLASS
  // ============================================================================

  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    // Remove all theme classes
    root.classList.remove('theme-minimal', 'theme-emerald', 'theme-ocean')

    // Apply the selected theme class (default uses :root, no class needed)
    if (theme === 'minimal') {
      root.classList.add('theme-minimal')
    } else if (theme === 'emerald') {
      root.classList.add('theme-emerald')
    } else if (theme === 'ocean') {
      root.classList.add('theme-ocean')
    }
  }, [theme, mounted])

  // ============================================================================
  // SETTERS (Update local + sync to DB)
  // ============================================================================

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    const updates = { theme: newTheme }
    saveToLocalStorage(updates)
    syncToDatabase(updates)
  }, [saveToLocalStorage, syncToDatabase])

  const setSidebarExpanded = useCallback((expanded: boolean) => {
    setSidebarExpandedState(expanded)
    const updates = { sidebar_expanded: expanded }
    saveToLocalStorage(updates)
    syncToDatabase(updates)
  }, [saveToLocalStorage, syncToDatabase])

  const setActiveProject = useCallback((project: ActiveProject | null) => {
    setActiveProjectState(project)
    const updates: UpdateSettingsInput = project
      ? {
          active_project_id: project.id,
          active_project_code: project.project_code,
          active_project_name: project.name,
        }
      : {
          active_project_id: null,
          active_project_code: null,
          active_project_name: null,
        }
    saveToLocalStorage(updates)
    syncToDatabase(updates)
  }, [saveToLocalStorage, syncToDatabase])

  const setLastSeenVersion = useCallback((version: string) => {
    setLastSeenVersionState(version)
    const updates = { last_seen_version: version }
    saveToLocalStorage(updates)
    syncToDatabase(updates)
  }, [saveToLocalStorage, syncToDatabase])

  const addToSearchHistory = useCallback((type: 'tiles' | 'symbols' | 'customers', term: string) => {
    if (!term.trim()) return

    const trimmedTerm = term.trim()

    const updateHistory = (
      current: string[],
      setter: React.Dispatch<React.SetStateAction<string[]>>,
      key: keyof UpdateSettingsInput
    ) => {
      const newHistory = [
        trimmedTerm,
        ...current.filter(t => t.toLowerCase() !== trimmedTerm.toLowerCase())
      ].slice(0, 10)

      setter(newHistory)
      const updates = { [key]: newHistory } as UpdateSettingsInput
      saveToLocalStorage(updates)
      syncToDatabase(updates)
    }

    if (type === 'tiles') {
      updateHistory(searchHistoryTiles, setSearchHistoryTiles, 'search_history_tiles')
    } else if (type === 'symbols') {
      updateHistory(searchHistorySymbols, setSearchHistorySymbols, 'search_history_symbols')
    } else {
      updateHistory(searchHistoryCustomers, setSearchHistoryCustomers, 'search_history_customers')
    }
  }, [searchHistoryTiles, searchHistorySymbols, searchHistoryCustomers, saveToLocalStorage, syncToDatabase])

  const clearSearchHistory = useCallback((type: 'tiles' | 'symbols' | 'customers') => {
    if (type === 'tiles') {
      setSearchHistoryTiles([])
      saveToLocalStorage({ search_history_tiles: [] })
      syncToDatabase({ search_history_tiles: [] })
    } else if (type === 'symbols') {
      setSearchHistorySymbols([])
      saveToLocalStorage({ search_history_symbols: [] })
      syncToDatabase({ search_history_symbols: [] })
    } else {
      setSearchHistoryCustomers([])
      saveToLocalStorage({ search_history_customers: [] })
      syncToDatabase({ search_history_customers: [] })
    }
  }, [saveToLocalStorage, syncToDatabase])

  const syncNow = useCallback(async () => {
    if (!isAuthenticated) return

    // Cancel pending debounced sync
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current)
    }

    // Sync all current state
    const allUpdates: UpdateSettingsInput = {
      theme,
      sidebar_expanded: sidebarExpanded,
      active_project_id: activeProject?.id || null,
      active_project_code: activeProject?.project_code || null,
      active_project_name: activeProject?.name || null,
      last_seen_version: lastSeenVersion,
      search_history_tiles: searchHistoryTiles,
      search_history_symbols: searchHistorySymbols,
      search_history_customers: searchHistoryCustomers,
    }

    setIsSyncing(true)
    try {
      await updateUserSettingsAction(session!.user!.email!, allUpdates)
    } finally {
      setIsSyncing(false)
    }
  }, [
    isAuthenticated, session, theme, sidebarExpanded, activeProject,
    lastSeenVersion, searchHistoryTiles, searchHistorySymbols, searchHistoryCustomers
  ])

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
      }
    }
  }, [])

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <UserSettingsContext.Provider
      value={{
        isLoading,
        isSyncing,
        isAuthenticated,
        theme,
        setTheme,
        sidebarExpanded,
        setSidebarExpanded,
        activeProject: mounted ? activeProject : null,
        setActiveProject,
        lastSeenVersion,
        setLastSeenVersion,
        searchHistoryTiles,
        searchHistorySymbols,
        searchHistoryCustomers,
        addToSearchHistory,
        clearSearchHistory,
        syncNow,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  )
}

// ============================================================================
// HOOKS
// ============================================================================

export function useUserSettings() {
  const context = useContext(UserSettingsContext)
  if (context === undefined) {
    throw new Error('useUserSettings must be used within UserSettingsProvider')
  }
  return context
}

// Convenience hooks for backward compatibility
export function useTheme() {
  const { theme, setTheme } = useUserSettings()
  return { theme, setTheme }
}

export function useSidebarState() {
  const { sidebarExpanded, setSidebarExpanded } = useUserSettings()
  return { sidebarExpanded, setSidebarExpanded }
}

export function useActiveProjectSettings() {
  const { activeProject, setActiveProject } = useUserSettings()
  return {
    activeProject,
    setActiveProject,
    clearActiveProject: () => setActiveProject(null),
    isActive: (projectId: string) => activeProject?.id === projectId,
  }
}

export function useSearchHistory(type: 'tiles' | 'symbols' | 'customers') {
  const settings = useUserSettings()

  const history = type === 'tiles'
    ? settings.searchHistoryTiles
    : type === 'symbols'
      ? settings.searchHistorySymbols
      : settings.searchHistoryCustomers

  const removeFromHistory = (term: string) => {
    const newHistory = history.filter(t => t !== term)
    // Update using the internal mechanism
    if (type === 'tiles') {
      settings.clearSearchHistory('tiles')
      newHistory.forEach(t => settings.addToSearchHistory('tiles', t))
    } else if (type === 'symbols') {
      settings.clearSearchHistory('symbols')
      newHistory.forEach(t => settings.addToSearchHistory('symbols', t))
    } else {
      settings.clearSearchHistory('customers')
      newHistory.forEach(t => settings.addToSearchHistory('customers', t))
    }
  }

  return {
    history,
    addToHistory: (term: string) => settings.addToSearchHistory(type, term),
    removeFromHistory,
    clearHistory: () => settings.clearSearchHistory(type),
  }
}
