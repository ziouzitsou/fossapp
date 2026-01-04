/**
 * Edit2D Markers - SVG Symbol Fetcher
 *
 * Handles fetching and caching of product SVG symbols from Supabase storage.
 */

import { SYMBOLS_BUCKET_URL } from './types'

/**
 * SVG Symbol Fetcher with in-memory caching
 *
 * Caches SVG content (or null for missing symbols) to avoid repeated fetches.
 * Uses a promise-based deduplication pattern to prevent duplicate in-flight requests.
 */
export class SvgFetcher {
  // SVG symbol cache: fossPid -> SVG content (or null if no symbol)
  private cache: Map<string, string | null> = new Map()
  private fetchPromises: Map<string, Promise<string | null>> = new Map()

  /**
   * Fetch SVG symbol for a product (with caching)
   *
   * @param fossPid - Product ID for symbol lookup
   * @returns SVG content string or null if not available
   */
  async fetchSymbolSvg(fossPid: string): Promise<string | null> {
    // Check cache first
    if (this.cache.has(fossPid)) {
      return this.cache.get(fossPid) ?? null
    }

    // Check if already fetching (deduplication)
    const pendingFetch = this.fetchPromises.get(fossPid)
    if (pendingFetch) {
      return pendingFetch
    }

    // Start fetch
    const fetchPromise = this.doFetch(fossPid)
    this.fetchPromises.set(fossPid, fetchPromise)
    return fetchPromise
  }

  /**
   * Internal fetch implementation
   */
  private async doFetch(fossPid: string): Promise<string | null> {
    try {
      const url = `${SYMBOLS_BUCKET_URL}/${fossPid}/${fossPid}-SYMBOL.svg?t=${Date.now()}`
      const response = await fetch(url)

      if (response.ok) {
        const svgText = await response.text()
        this.cache.set(fossPid, svgText)
        return svgText
      }

      this.cache.set(fossPid, null)
      return null
    } catch (err) {
      console.warn(`[SvgFetcher] Failed to fetch SVG for ${fossPid}:`, err)
      this.cache.set(fossPid, null)
      return null
    } finally {
      this.fetchPromises.delete(fossPid)
    }
  }

  /**
   * Clear the cache (useful for testing or memory cleanup)
   */
  clearCache(): void {
    this.cache.clear()
    this.fetchPromises.clear()
  }
}
