/**
 * Currency Conversion Service
 *
 * Fetches USD to EUR exchange rate from Fawaz Ahmed Currency API
 * - Caches rate for 24 hours
 * - Falls back to 0.86 if API unavailable
 * - 5 second timeout on requests
 */

const CURRENCY_API_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'
const FALLBACK_RATE = 0.86
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
const REQUEST_TIMEOUT_MS = 5000 // 5 seconds

interface CurrencyCache {
  rate: number
  fetchedAt: number
  source: 'api' | 'fallback'
}

// Global cache using globalThis for persistence across API routes
const globalForCurrency = globalThis as unknown as {
  currencyCache: CurrencyCache | undefined
}

/**
 * Fetch USD to EUR exchange rate with caching
 */
export async function getUsdToEurRate(): Promise<number> {
  const now = Date.now()

  // Check cache
  if (globalForCurrency.currencyCache) {
    const cache = globalForCurrency.currencyCache
    const age = now - cache.fetchedAt

    if (age < CACHE_DURATION_MS) {
      return cache.rate
    }
  }

  // Fetch fresh rate
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const response = await fetch(CURRENCY_API_URL, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const rate = data?.usd?.eur

    if (typeof rate !== 'number' || isNaN(rate)) {
      throw new Error('Invalid rate in response')
    }

    // Cache the rate
    globalForCurrency.currencyCache = {
      rate,
      fetchedAt: now,
      source: 'api',
    }

    console.log(`[Currency] Fetched USD/EUR rate: ${rate.toFixed(4)} (cached for 24h)`)
    return rate

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`[Currency] Failed to fetch rate: ${errorMsg}. Using fallback: ${FALLBACK_RATE}`)

    // Cache the fallback (but with shorter duration for retry)
    globalForCurrency.currencyCache = {
      rate: FALLBACK_RATE,
      fetchedAt: now - (CACHE_DURATION_MS - 60 * 60 * 1000), // Retry in 1 hour
      source: 'fallback',
    }

    return FALLBACK_RATE
  }
}

/**
 * Convert USD to EUR
 */
export async function usdToEur(usd: number): Promise<number> {
  const rate = await getUsdToEurRate()
  return usd * rate
}

/**
 * Format currency with both USD and EUR
 */
export async function formatUsdEur(usd: number): Promise<string> {
  const eur = await usdToEur(usd)
  return `$${usd.toFixed(4)} (~€${eur.toFixed(4)})`
}

/**
 * Get current cache status (for debugging)
 */
export function getCacheStatus(): { cached: boolean; age?: number; source?: string } {
  if (!globalForCurrency.currencyCache) {
    return { cached: false }
  }

  const age = Date.now() - globalForCurrency.currencyCache.fetchedAt
  return {
    cached: true,
    age: Math.round(age / 1000 / 60), // minutes
    source: globalForCurrency.currencyCache.source,
  }
}
