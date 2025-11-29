'use server'

import { supabaseServer } from './supabase-server'
import type { SearchFilters, SearchProduct, TaxonomyNode, FilterFacet, DynamicFacet, FilterDefinition } from '@/types/search'

/**
 * Advanced search with dynamic filters (filter sidebar, facets, etc.)
 * Used by: /products page with filter sidebar
 * For basic text search, use searchProductsBasicAction from actions.ts
 */
export async function searchProductsWithFiltersAction(filters: SearchFilters) {
  try {
    const { data, error } = await supabaseServer
      .schema('search')
      .rpc('search_products_with_filters', {
        p_query: filters.query || null,
        p_filters: filters.filters || {},
        p_taxonomy_codes: filters.categories || null,
        p_suppliers: filters.suppliers || null,
        p_indoor: filters.indoor ?? null,
        p_outdoor: filters.outdoor ?? null,
        p_submersible: filters.submersible ?? null,
        p_trimless: filters.trimless ?? null,
        p_cut_shape_round: filters.cutShapeRound ?? null,
        p_cut_shape_rectangular: filters.cutShapeRectangular ?? null,
        p_sort_by: filters.sortBy || 'relevance',
        p_limit: filters.limit || 24,
        p_offset: (filters.page || 0) * (filters.limit || 24)
      })

    if (error) {
      console.error('Search error:', error)
      return { products: [], total: 0 }
    }

    return { products: data as SearchProduct[], total: data?.length || 0 }
  } catch (error) {
    console.error('Search exception:', error)
    return { products: [], total: 0 }
  }
}

/**
 * Count products matching filters
 * Uses search.count_products_with_filters function
 */
export async function countProductsAction(filters: SearchFilters) {
  try {
    const { data, error } = await supabaseServer
      .schema('search')
      .rpc('count_products_with_filters', {
        p_query: filters.query || null,
        p_filters: filters.filters || {},
        p_taxonomy_codes: filters.categories || null,
        p_suppliers: filters.suppliers || null,
        p_indoor: filters.indoor ?? null,
        p_outdoor: filters.outdoor ?? null,
        p_submersible: filters.submersible ?? null,
        p_trimless: filters.trimless ?? null,
        p_cut_shape_round: filters.cutShapeRound ?? null,
        p_cut_shape_rectangular: filters.cutShapeRectangular ?? null
      })

    if (error) {
      console.error('Count error:', error)
      return 0
    }

    return data || 0
  } catch (error) {
    console.error('Count exception:', error)
    return 0
  }
}

/**
 * Get taxonomy tree (product categories hierarchy)
 * Uses search.get_taxonomy_tree function
 */
export async function getTaxonomyTreeAction(): Promise<TaxonomyNode[]> {
  try {
    const { data, error } = await supabaseServer
      .schema('search')
      .rpc('get_taxonomy_tree')

    if (error) {
      console.error('Taxonomy tree error:', error)
      return []
    }

    return data as TaxonomyNode[] || []
  } catch (error) {
    console.error('Taxonomy tree exception:', error)
    return []
  }
}

/**
 * Get filter facets with context (for contextual filter counts)
 * Uses search.get_filter_facets_with_context function
 */
export async function getFilterFacetsAction(filters: SearchFilters): Promise<FilterFacet[]> {
  try {
    const { data, error } = await supabaseServer
      .schema('search')
      .rpc('get_filter_facets_with_context', {
        p_query: filters.query || null,
        p_taxonomy_codes: filters.categories || null,
        p_suppliers: filters.suppliers || null,
        p_indoor: filters.indoor ?? null,
        p_outdoor: filters.outdoor ?? null,
        p_submersible: filters.submersible ?? null,
        p_trimless: filters.trimless ?? null,
        p_cut_shape_round: filters.cutShapeRound ?? null,
        p_cut_shape_rectangular: filters.cutShapeRectangular ?? null
      })

    if (error) {
      console.error('Filter facets error:', error)
      return []
    }

    return data as FilterFacet[] || []
  } catch (error) {
    console.error('Filter facets exception:', error)
    return []
  }
}

/**
 * Get dynamic facets (ETIM feature-based filters)
 * Uses search.get_dynamic_facets function
 */
export async function getDynamicFacetsAction(filters: SearchFilters): Promise<DynamicFacet[]> {
  try {
    const { data, error } = await supabaseServer
      .schema('search')
      .rpc('get_dynamic_facets', {
        p_taxonomy_codes: filters.categories || null,
        p_filters: filters.filters || {},
        p_suppliers: filters.suppliers || null,
        p_indoor: filters.indoor ?? null,
        p_outdoor: filters.outdoor ?? null,
        p_submersible: filters.submersible ?? null,
        p_trimless: filters.trimless ?? null,
        p_cut_shape_round: filters.cutShapeRound ?? null,
        p_cut_shape_rectangular: filters.cutShapeRectangular ?? null,
        p_query: filters.query || null
      })

    if (error) {
      console.error('Dynamic facets error:', error)
      return []
    }

    return data as DynamicFacet[] || []
  } catch (error) {
    console.error('Dynamic facets exception:', error)
    return []
  }
}

/**
 * Get filter definitions from database
 * Fetches all active filters from search.filter_definitions
 */
export async function getFilterDefinitionsAction(): Promise<FilterDefinition[]> {
  try {
    const { data, error } = await supabaseServer
      .schema('search')
      .from('filter_definitions')
      .select('*')
      .eq('active', true)
      .order('display_order')

    if (error) {
      console.error('Filter definitions error:', error)
      return []
    }

    return data as FilterDefinition[] || []
  } catch (error) {
    console.error('Filter definitions exception:', error)
    return []
  }
}
