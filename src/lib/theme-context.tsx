'use client'

/**
 * Theme Context - Backward Compatibility Layer
 *
 * This module now delegates to UserSettingsProvider for cross-device sync.
 * Existing imports continue to work unchanged.
 *
 * @deprecated Use useUserSettings() from '@/lib/user-settings-context' directly
 */

import { useUserSettings } from './user-settings-context'

export type Theme = 'default' | 'supabase' | 'graphite'

/**
 * @deprecated Use useUserSettings() or useTheme() from '@/lib/user-settings-context'
 */
export function useMultiTheme() {
  const { theme, setTheme } = useUserSettings()
  return { theme, setTheme }
}

/**
 * @deprecated MultiThemeProvider is no longer needed.
 * UserSettingsProvider in providers.tsx handles theme management.
 * This component is kept for backward compatibility but does nothing.
 */
export function MultiThemeProvider({ children }: { children: React.ReactNode }) {
  // No-op - UserSettingsProvider handles theme now
  return <>{children}</>
}
