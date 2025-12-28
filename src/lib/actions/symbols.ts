'use server'

import { supabaseServer } from '@fossapp/core/db'

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
