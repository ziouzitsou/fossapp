'use server'

import { supabaseServer } from '@fossapp/core/db'
import { getGoogleDriveSymbolService } from '@/lib/symbol-generator/google-drive-symbol-service'

export interface SymbolRule {
  id: number
  symbol: string
  name: string
  etim_class: string
  etim_class_desc: string | null
  ip_min: number | null
  ip_max: number | null
  is_active: boolean
  notes: string | null
}

export async function getSymbolRulesAction(): Promise<SymbolRule[]> {
  const { data, error } = await supabaseServer
    .schema('items')
    .from('symbol_rules')
    .select('id, symbol, name, etim_class, etim_class_desc, ip_min, ip_max, is_active, notes')
    .order('symbol')

  if (error) {
    console.error('Failed to fetch symbol rules:', error)
    return []
  }

  return data || []
}

/**
 * Delete a product symbol (files from storage + database record)
 * Deletes the entire {foss_pid}/ folder from product-symbols bucket
 */
export async function deleteProductSymbolAction(fossPid: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. List all files in the product folder
    const { data: files, error: listError } = await supabaseServer
      .storage
      .from('product-symbols')
      .list(fossPid)

    if (listError) {
      console.error('Failed to list symbol files:', listError)
      return { success: false, error: 'Failed to list files' }
    }

    // 2. Delete all files in the folder
    if (files && files.length > 0) {
      const filePaths = files.map(f => `${fossPid}/${f.name}`)
      const { error: deleteFilesError } = await supabaseServer
        .storage
        .from('product-symbols')
        .remove(filePaths)

      if (deleteFilesError) {
        console.error('Failed to delete symbol files:', deleteFilesError)
        return { success: false, error: 'Failed to delete files from storage' }
      }
    }

    // 3. Delete the database record
    const { error: dbError } = await supabaseServer
      .schema('items')
      .from('product_symbols')
      .delete()
      .eq('foss_pid', fossPid)

    if (dbError) {
      console.error('Failed to delete symbol record:', dbError)
      return { success: false, error: 'Failed to delete database record' }
    }

    // 4. Delete from Google Drive (non-fatal if fails)
    try {
      const driveService = getGoogleDriveSymbolService()
      const driveResult = await driveService.deleteSymbol(fossPid)
      if (!driveResult.success) {
        console.error('Failed to delete symbol from Google Drive:', driveResult.error)
        // Continue - Supabase is source of truth
      }
    } catch (driveError) {
      console.error('Google Drive delete error:', driveError)
      // Continue - Supabase is source of truth
    }

    return { success: true }
  } catch (err) {
    console.error('Delete symbol error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
