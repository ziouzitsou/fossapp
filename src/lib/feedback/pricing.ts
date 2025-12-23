/**
 * Claude Pricing Utility
 *
 * Calculate and display costs for AI chat messages.
 * Prices are in USD per 1 million tokens, with EUR conversion.
 *
 * @see https://www.anthropic.com/pricing
 * @see https://github.com/fawazahmed0/currency-api (free currency API)
 */

// ============================================================================
// Currency Conversion (USD → EUR)
// ============================================================================

// Cache for exchange rate (refreshes daily)
let cachedRate: { rate: number; fetchedAt: number } | null = null
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
const FALLBACK_RATE = 0.96 // Approximate EUR/USD rate

/**
 * Fetch current USD to EUR exchange rate
 * Uses free currency-api with CDN hosting (no API key needed)
 */
export async function getUsdToEurRate(): Promise<number> {
  // Return cached rate if still valid
  if (cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_DURATION_MS) {
    return cachedRate.rate
  }

  try {
    const response = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      { next: { revalidate: 86400 } } // Cache for 24h in Next.js
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const rate = data?.usd?.eur ?? FALLBACK_RATE

    // Cache the rate
    cachedRate = { rate, fetchedAt: Date.now() }
    return rate
  } catch (error) {
    console.warn('[Pricing] Currency API failed, using fallback rate:', error)
    return FALLBACK_RATE
  }
}

/**
 * Convert USD to EUR (sync version using cached/fallback rate)
 */
export function usdToEur(usd: number): number {
  const rate = cachedRate?.rate ?? FALLBACK_RATE
  return usd * rate
}

// ============================================================================
// Pricing Configuration
// ============================================================================

export interface ModelPricing {
  input: number // $ per 1M input tokens
  output: number // $ per 1M output tokens
  displayName: string
}

/**
 * Claude model pricing (as of December 2025)
 * Note: OpenRouter may add a small markup
 */
export const CLAUDE_PRICING: Record<string, ModelPricing> = {
  // Claude 4 models (via OpenRouter format)
  'anthropic/claude-sonnet-4': {
    input: 3.0,
    output: 15.0,
    displayName: 'Claude Sonnet 4',
  },
  'anthropic/claude-opus-4': {
    input: 15.0,
    output: 75.0,
    displayName: 'Claude Opus 4',
  },
  // Claude 3.5 models
  'anthropic/claude-3.5-sonnet': {
    input: 3.0,
    output: 15.0,
    displayName: 'Claude 3.5 Sonnet',
  },
  'anthropic/claude-3.5-haiku': {
    input: 0.25,
    output: 1.25,
    displayName: 'Claude 3.5 Haiku',
  },
  // Direct Anthropic format (fallback)
  'claude-sonnet-4-20250514': {
    input: 3.0,
    output: 15.0,
    displayName: 'Claude Sonnet 4',
  },
}

// Default pricing if model not found
const DEFAULT_PRICING: ModelPricing = {
  input: 3.0,
  output: 15.0,
  displayName: 'Claude',
}

// ============================================================================
// Pricing Functions
// ============================================================================

/**
 * Get pricing for a model
 */
export function getModelPricing(model: string): ModelPricing {
  return CLAUDE_PRICING[model] || DEFAULT_PRICING
}

/**
 * Calculate cost in USD for a message
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getModelPricing(model)
  const inputCost = (inputTokens * pricing.input) / 1_000_000
  const outputCost = (outputTokens * pricing.output) / 1_000_000
  return inputCost + outputCost
}

/**
 * Format cost for display in USD (e.g., "$0.0012" or "< $0.0001")
 */
export function formatCost(cost: number): string {
  if (cost === 0) {
    return '$0.00'
  }
  if (cost < 0.0001) {
    return '< $0.0001'
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }
  return `$${cost.toFixed(2)}`
}

/**
 * Format cost for display in EUR (e.g., "€0.0012" or "< €0.0001")
 * Uses cached exchange rate or fallback
 */
export function formatCostEur(costUsd: number): string {
  const costEur = usdToEur(costUsd)
  if (costEur === 0) {
    return '€0.00'
  }
  if (costEur < 0.0001) {
    return '< €0.0001'
  }
  if (costEur < 0.01) {
    return `€${costEur.toFixed(4)}`
  }
  return `€${costEur.toFixed(2)}`
}

/**
 * Format cost showing both USD and EUR
 */
export function formatCostBoth(costUsd: number): string {
  return `${formatCost(costUsd)} (${formatCostEur(costUsd)})`
}

/**
 * Format token count with commas (e.g., "1,234")
 */
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString()
}

/**
 * Get a summary string for display
 * e.g., "423 in / 1,245 out • $0.0195"
 */
export function getUsageSummary(
  inputTokens: number,
  outputTokens: number,
  cost: number
): string {
  return `${formatTokens(inputTokens)} in / ${formatTokens(outputTokens)} out • ${formatCost(cost)}`
}

/**
 * Estimate tokens from text (rough approximation)
 * Claude uses ~4 characters per token on average
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Estimate cost before sending (rough approximation)
 */
export function estimateCost(
  model: string,
  inputText: string,
  estimatedOutputTokens: number = 500
): { estimatedInputTokens: number; estimatedCost: number } {
  const estimatedInputTokens = estimateTokens(inputText)
  const estimatedCost = calculateCost(
    model,
    estimatedInputTokens,
    estimatedOutputTokens
  )
  return { estimatedInputTokens, estimatedCost }
}
