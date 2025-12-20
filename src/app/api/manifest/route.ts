import { NextResponse } from 'next/server'
import { APP_CONFIG, PWA_CONFIG } from '@/lib/config'

/**
 * Dynamic Web App Manifest
 *
 * This API route generates the manifest.json dynamically based on the
 * centralized configuration in src/lib/config.ts.
 *
 * This ensures the manifest always uses the correct production domain
 * even if it changes in future releases.
 */
export async function GET() {
  const manifest = {
    name: APP_CONFIG.APP_NAME,
    short_name: APP_CONFIG.APP_SHORT_NAME,
    description: APP_CONFIG.APP_DESCRIPTION,
    start_url: PWA_CONFIG.startUrl,
    display: PWA_CONFIG.display,
    background_color: PWA_CONFIG.backgroundColor,
    theme_color: PWA_CONFIG.themeColor.dark,
    orientation: PWA_CONFIG.orientation,
    scope: PWA_CONFIG.scope,
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshot-desktop.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
      },
      {
        src: '/screenshot-mobile.png',
        sizes: '750x1334',
        type: 'image/png',
        form_factor: 'narrow',
      },
    ],
    categories: PWA_CONFIG.categories,
    shortcuts: [
      {
        name: 'Search Products',
        short_name: 'Search',
        description: 'Search lighting products',
        url: '/products',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
          },
        ],
      },
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'View dashboard',
        url: '/dashboard',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
          },
        ],
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600, immutable',
    },
  })
}
