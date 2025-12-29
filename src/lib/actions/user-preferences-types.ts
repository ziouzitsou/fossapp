// Types and defaults for user preferences
// Separate from server actions to avoid 'use server' export restrictions

export interface ViewPreferences {
  marker_min_screen_px: number
  // Viewer background gradient colors (hex format)
  viewer_bg_top_color?: string    // e.g., "#404040"
  viewer_bg_bottom_color?: string // e.g., "#000000"
  // Reverse mouse wheel zoom direction (like AutoCAD)
  reverse_zoom_direction?: boolean
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
  viewer_bg_top_color: '#2a2a2a',
  viewer_bg_bottom_color: '#0a0a0a',
  reverse_zoom_direction: false,
}
