'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { logEventClient } from '@/lib/event-logger'

/**
 * Hook to track page load performance
 *
 * Automatically logs page_load_time event when component mounts
 * Uses the Performance API to get accurate timing data
 *
 * Usage:
 *   function MyPage() {
 *     usePagePerformance()
 *     return <div>...</div>
 *   }
 */
export function usePagePerformance() {
  const pathname = usePathname()

  useEffect(() => {
    // Wait for the page to be fully loaded
    if (typeof window === 'undefined') return

    const measurePerformance = () => {
      try {
        const perfData = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

        if (!perfData) {
          console.warn('[Performance] Navigation timing not available')
          return
        }

        // Calculate various timing metrics
        const loadTime = perfData.loadEventEnd - perfData.fetchStart
        const domContentLoaded = perfData.domContentLoadedEventEnd - perfData.fetchStart
        const domInteractive = perfData.domInteractive - perfData.fetchStart

        // Log page load time event
        logEventClient('page_load_time', {
          pathname,
          load_time_ms: Math.round(loadTime),
          dom_content_loaded_ms: Math.round(domContentLoaded),
          dom_interactive_ms: Math.round(domInteractive),
          transfer_size_kb: Math.round(perfData.transferSize / 1024),
        })
      } catch (error) {
        console.error('[Performance] Failed to measure:', error)
      }
    }

    // Wait for load event
    if (document.readyState === 'complete') {
      // Page already loaded
      setTimeout(measurePerformance, 0)
    } else {
      // Wait for load event
      window.addEventListener('load', measurePerformance, { once: true })
      return () => window.removeEventListener('load', measurePerformance)
    }
  }, [pathname])
}
