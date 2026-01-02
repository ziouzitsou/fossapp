/**
 * Responsive Breakpoint Hooks
 *
 * Client-side hooks for detecting viewport size breakpoints.
 * Uses matchMedia for efficient resize detection.
 *
 * @remarks
 * Breakpoints match Tailwind CSS defaults:
 * - Mobile: < 768px (md breakpoint)
 * - Tablet: 768px - 1024px
 * - Desktop: >= 1024px (lg breakpoint)
 *
 * @module @fossapp/ui
 */
'use client'

import * as React from "react"

/** Mobile breakpoint in pixels (matches Tailwind 'md') */
const MOBILE_BREAKPOINT = 768
/** Tablet upper breakpoint in pixels (matches Tailwind 'lg') */
const TABLET_BREAKPOINT = 1024

/**
 * Hook to detect if viewport is mobile-sized (< 768px).
 *
 * @remarks
 * Returns `false` during SSR and initial hydration, then updates
 * reactively as viewport changes. Uses matchMedia for performance.
 *
 * @returns true if viewport width < 768px
 *
 * @example
 * const isMobile = useIsMobile()
 * return isMobile ? <MobileNav /> : <DesktopNav />
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

/**
 * Hook to detect if viewport is tablet-sized (768px - 1024px).
 *
 * @remarks
 * Used by the Sidebar to auto-collapse on tablet viewports.
 * Returns `false` during SSR and initial hydration.
 *
 * @returns true if viewport width is between 768px and 1024px
 *
 * @example
 * const isTablet = useIsTablet()
 * // Show compact layout on tablet
 */
export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const checkTablet = () => {
      const width = window.innerWidth
      setIsTablet(width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT)
    }

    const mqlMin = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`)
    const mqlMax = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`)

    const onChange = () => checkTablet()

    mqlMin.addEventListener("change", onChange)
    mqlMax.addEventListener("change", onChange)
    checkTablet()

    return () => {
      mqlMin.removeEventListener("change", onChange)
      mqlMax.removeEventListener("change", onChange)
    }
  }, [])

  return !!isTablet
}
