// Types and defaults for user preferences
// Separate from server actions to avoid 'use server' export restrictions

export interface ViewPreferences {
  marker_min_screen_px: number
}

export interface UserPreferences {
  id: string
  user_email: string
  view_preferences: ViewPreferences
  created_at: string
  updated_at: string
}

// Default values
export const DEFAULT_VIEW_PREFERENCES: ViewPreferences = {
  marker_min_screen_px: 12,
}
