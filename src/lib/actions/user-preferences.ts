'use server'

import { supabaseServer } from '@fossapp/core/db'
import {
  DEFAULT_VIEW_PREFERENCES,
  type ViewPreferences,
  type UserPreferences,
} from './user-preferences-types'

/**
 * Get user preferences by email
 * Creates default preferences if none exist
 */
export async function getUserPreferencesAction(
  email: string
): Promise<{ success: boolean; data?: UserPreferences; error?: string }> {
  try {
    // Try to get existing preferences
    const { data, error } = await supabaseServer
      .from('user_preferences')
      .select('*')
      .eq('user_email', email)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is OK
      console.error('[getUserPreferences] Error:', error)
      return { success: false, error: error.message }
    }

    if (data) {
      return { success: true, data: data as UserPreferences }
    }

    // No preferences found - create defaults
    const { data: newData, error: insertError } = await supabaseServer
      .from('user_preferences')
      .insert({
        user_email: email,
        view_preferences: DEFAULT_VIEW_PREFERENCES,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[getUserPreferences] Insert error:', insertError)
      return { success: false, error: insertError.message }
    }

    return { success: true, data: newData as UserPreferences }
  } catch (err) {
    console.error('[getUserPreferences] Unexpected error:', err)
    return { success: false, error: 'Failed to get user preferences' }
  }
}

/**
 * Update view preferences for a user
 */
export async function updateViewPreferencesAction(
  email: string,
  preferences: Partial<ViewPreferences>
): Promise<{ success: boolean; data?: UserPreferences; error?: string }> {
  try {
    // First get current preferences
    const current = await getUserPreferencesAction(email)
    if (!current.success || !current.data) {
      return { success: false, error: current.error || 'Failed to get current preferences' }
    }

    // Merge with new preferences
    const updatedViewPrefs = {
      ...current.data.view_preferences,
      ...preferences,
    }

    // Update
    const { data, error } = await supabaseServer
      .from('user_preferences')
      .update({ view_preferences: updatedViewPrefs })
      .eq('user_email', email)
      .select()
      .single()

    if (error) {
      console.error('[updateViewPreferences] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as UserPreferences }
  } catch (err) {
    console.error('[updateViewPreferences] Unexpected error:', err)
    return { success: false, error: 'Failed to update view preferences' }
  }
}
