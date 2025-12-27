'use server'

import { supabaseServer } from '@fossapp/core/db/server'

// ============================================================================
// INTERFACES
// ============================================================================

export interface UserSettings {
  user_id: string
  // UI Preferences
  theme: 'default' | 'minimal' | 'emerald' | 'ocean'
  sidebar_expanded: boolean
  // Context State
  active_project_id: string | null
  active_project_code: string | null
  active_project_name: string | null
  // Feature Tracking
  last_seen_version: string | null
  // Search Histories
  search_history_tiles: string[]
  search_history_symbols: string[]
  search_history_customers: string[]
  // Timestamps
  updated_at: string
}

export interface UpdateSettingsInput {
  theme?: 'default' | 'minimal' | 'emerald' | 'ocean'
  sidebar_expanded?: boolean
  active_project_id?: string | null
  active_project_code?: string | null
  active_project_name?: string | null
  last_seen_version?: string | null
  search_history_tiles?: string[]
  search_history_symbols?: string[]
  search_history_customers?: string[]
}

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// GET USER SETTINGS
// ============================================================================

/**
 * Fetch user settings by email
 * Returns null if user not found
 */
export async function getUserSettingsAction(
  email: string
): Promise<ActionResult<UserSettings>> {
  try {
    if (!email?.trim()) {
      return { success: false, error: 'Email is required' }
    }

    const normalizedEmail = email.toLowerCase().trim()

    // First get user ID from email
    const { data: user, error: userError } = await supabaseServer
      .schema('analytics')
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single()

    if (userError || !user) {
      // User doesn't exist yet - this is not an error, they might be logging in for the first time
      return { success: false, error: 'User not found' }
    }

    // Get settings
    const { data: settings, error: settingsError } = await supabaseServer
      .schema('analytics')
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (settingsError) {
      // Settings don't exist - create default settings
      if (settingsError.code === 'PGRST116') {
        const { data: newSettings, error: createError } = await supabaseServer
          .schema('analytics')
          .from('user_settings')
          .insert({ user_id: user.id })
          .select('*')
          .single()

        if (createError) {
          console.error('Create default settings error:', createError)
          return { success: false, error: 'Failed to create default settings' }
        }

        return { success: true, data: newSettings }
      }

      console.error('Get settings error:', settingsError)
      return { success: false, error: 'Failed to get settings' }
    }

    return { success: true, data: settings }
  } catch (error) {
    console.error('Get user settings error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// UPDATE USER SETTINGS
// ============================================================================

/**
 * Update user settings by email
 * Creates settings if they don't exist
 */
export async function updateUserSettingsAction(
  email: string,
  input: UpdateSettingsInput
): Promise<ActionResult<UserSettings>> {
  try {
    if (!email?.trim()) {
      return { success: false, error: 'Email is required' }
    }

    // First get user ID from email
    const { data: user, error: userError } = await supabaseServer
      .schema('analytics')
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (userError || !user) {
      return { success: false, error: 'User not found' }
    }

    // Build update object
    const updateData: Record<string, unknown> = {}

    if (input.theme !== undefined) updateData.theme = input.theme
    if (input.sidebar_expanded !== undefined) updateData.sidebar_expanded = input.sidebar_expanded
    if (input.active_project_id !== undefined) updateData.active_project_id = input.active_project_id
    if (input.active_project_code !== undefined) updateData.active_project_code = input.active_project_code
    if (input.active_project_name !== undefined) updateData.active_project_name = input.active_project_name
    if (input.last_seen_version !== undefined) updateData.last_seen_version = input.last_seen_version
    if (input.search_history_tiles !== undefined) updateData.search_history_tiles = input.search_history_tiles
    if (input.search_history_symbols !== undefined) updateData.search_history_symbols = input.search_history_symbols
    if (input.search_history_customers !== undefined) updateData.search_history_customers = input.search_history_customers

    // Upsert settings (insert if not exists, update if exists)
    const { data: settings, error: settingsError } = await supabaseServer
      .schema('analytics')
      .from('user_settings')
      .upsert({
        user_id: user.id,
        ...updateData
      }, {
        onConflict: 'user_id'
      })
      .select('*')
      .single()

    if (settingsError) {
      console.error('Update settings error:', settingsError)
      return { success: false, error: 'Failed to update settings' }
    }

    return { success: true, data: settings }
  } catch (error) {
    console.error('Update user settings error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// ADD TO SEARCH HISTORY
// ============================================================================

type SearchHistoryType = 'tiles' | 'symbols' | 'customers'

/**
 * Add a search term to user's search history
 * Maintains max 10 items, most recent first
 */
export async function addToSearchHistoryAction(
  email: string,
  type: SearchHistoryType,
  searchTerm: string
): Promise<ActionResult> {
  try {
    if (!email?.trim()) {
      return { success: false, error: 'Email is required' }
    }

    if (!searchTerm?.trim()) {
      return { success: false, error: 'Search term is required' }
    }

    const term = searchTerm.trim()

    // Get current settings
    const result = await getUserSettingsAction(email)
    if (!result.success || !result.data) {
      return { success: false, error: 'Failed to get current settings' }
    }

    // Get current history for the type
    const historyKey = `search_history_${type}` as const
    const currentHistory = result.data[historyKey] || []

    // Remove duplicate if exists, add to front, keep max 10
    const newHistory = [
      term,
      ...currentHistory.filter((t: string) => t.toLowerCase() !== term.toLowerCase())
    ].slice(0, 10)

    // Update settings
    const updateInput: UpdateSettingsInput = {
      [historyKey]: newHistory
    }

    const updateResult = await updateUserSettingsAction(email, updateInput)
    return { success: updateResult.success, error: updateResult.error }
  } catch (error) {
    console.error('Add to search history error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// CLEAR SEARCH HISTORY
// ============================================================================

/**
 * Clear search history for a specific type
 */
export async function clearSearchHistoryAction(
  email: string,
  type: SearchHistoryType
): Promise<ActionResult> {
  try {
    const historyKey = `search_history_${type}` as const
    const updateInput: UpdateSettingsInput = {
      [historyKey]: []
    }

    const updateResult = await updateUserSettingsAction(email, updateInput)
    return { success: updateResult.success, error: updateResult.error }
  } catch (error) {
    console.error('Clear search history error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
