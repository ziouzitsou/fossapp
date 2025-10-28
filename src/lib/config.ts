/**
 * Centralized Application Configuration
 *
 * This file contains hardcoded production values that can be easily updated
 * when the domain or other infrastructure changes in future releases.
 *
 * IMPORTANT: Update these values when deploying to a new domain or environment.
 */

export const APP_CONFIG = {
  /**
   * Production domain (without protocol)
   * Used for: PWA manifest, canonical URLs, sitemap generation
   *
   * Current: main.fossapp.online (as of 2025-10-28)
   * Previous: app.titancnc.eu (still active during transition)
   */
  PRODUCTION_DOMAIN: 'main.fossapp.online',

  /**
   * Production URL (with protocol)
   * Used for: OAuth callbacks, API endpoints, absolute URLs
   *
   * Current: https://main.fossapp.online (as of 2025-10-28)
   * Previous: https://app.titancnc.eu (still active during transition)
   */
  PRODUCTION_URL: 'https://main.fossapp.online',

  /**
   * Application metadata
   */
  APP_NAME: 'FOSSAPP - Lighting Product Database',
  APP_SHORT_NAME: 'FOSSAPP',
  APP_DESCRIPTION: 'Professional lighting product database for architects and designers. Search 56,456+ products with ETIM classification.',

  /**
   * Environment detection
   */
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  /**
   * Get the current base URL (environment-aware)
   * Falls back to NEXTAUTH_URL in development, hardcoded production URL in production
   */
  getBaseUrl: () => {
    if (typeof window !== 'undefined') {
      // Client-side: use window.location
      return `${window.location.protocol}//${window.location.host}`
    }

    // Server-side
    if (process.env.NODE_ENV === 'development') {
      return process.env.NEXTAUTH_URL || 'http://localhost:8080'
    }

    // Production: use hardcoded value
    return 'https://app.titancnc.eu'
  },

  /**
   * Get the current domain (without protocol)
   */
  getDomain: () => {
    if (typeof window !== 'undefined') {
      return window.location.host
    }

    if (process.env.NODE_ENV === 'development') {
      return 'localhost:8080'
    }

    return 'app.titancnc.eu'
  },
} as const

/**
 * PWA Configuration
 */
export const PWA_CONFIG = {
  themeColor: {
    light: '#ffffff',
    dark: '#000000',
  },
  backgroundColor: '#ffffff',
  display: 'standalone',
  orientation: 'any',
  scope: '/',
  startUrl: '/',
  categories: ['business', 'productivity'],
} as const

/**
 * Helper function to get the full production URL
 * Use this instead of hardcoding URLs throughout the app
 */
export function getProductionUrl(path: string = ''): string {
  const baseUrl = APP_CONFIG.getBaseUrl()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${cleanPath}`
}

/**
 * Helper function to determine if we're running in production
 */
export function isProductionDeployment(): boolean {
  return APP_CONFIG.isProduction
}
