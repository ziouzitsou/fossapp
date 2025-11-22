/**
 * API Client with automatic error tracking
 *
 * Wrapper around fetch() that logs API errors to analytics
 */

import { logEventClient } from './event-logger'

interface FetchOptions extends RequestInit {
  trackPerformance?: boolean
}

/**
 * Enhanced fetch with error tracking and performance monitoring
 *
 * @param url - API endpoint
 * @param options - Fetch options + tracking flags
 * @returns Response object
 *
 * @example
 * const data = await apiClient('/api/products/search?q=downlight')
 * const json = await data.json()
 */
export async function apiClient(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { trackPerformance = true, ...fetchOptions } = options
  const startTime = performance.now()

  try {
    const response = await fetch(url, fetchOptions)

    // Track response time
    if (trackPerformance) {
      const responseTime = performance.now() - startTime

      logEventClient('api_response_time', {
        endpoint: url,
        response_time_ms: Math.round(responseTime),
        status_code: response.status,
        method: fetchOptions.method || 'GET',
      })
    }

    // Track API errors (4xx, 5xx)
    if (!response.ok) {
      const errorData = await response.clone().json().catch(() => null)

      logEventClient('api_error', {
        endpoint: url,
        status_code: response.status,
        method: fetchOptions.method || 'GET',
        error_message: errorData?.error || response.statusText,
      })
    }

    return response
  } catch (error) {
    // Network errors, timeouts, etc.
    logEventClient('api_error', {
      endpoint: url,
      method: fetchOptions.method || 'GET',
      error_type: 'network_error',
      error_message: error instanceof Error ? error.message : String(error),
    })

    throw error
  }
}

/**
 * Convenience method for GET requests with JSON response
 */
export async function apiGet<T = unknown>(url: string): Promise<T> {
  const response = await apiClient(url)
  return response.json()
}

/**
 * Convenience method for POST requests with JSON body and response
 */
export async function apiPost<T = unknown>(
  url: string,
  body: unknown
): Promise<T> {
  const response = await apiClient(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return response.json()
}
