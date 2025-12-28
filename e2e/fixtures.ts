/**
 * E2E Test Fixtures
 *
 * Custom Playwright fixtures for FOSSAPP E2E testing.
 * Includes automatic session mocking for authenticated tests.
 *
 * Usage:
 *   import { test, expect } from './fixtures'  // Instead of @playwright/test
 *
 * When E2E_TEST_SECRET is configured:
 * - All requests include the x-e2e-test-key header (via config)
 * - /api/auth/session is intercepted to return mock session
 * - useSession() works automatically in components
 */

import { test as base, expect, type Page } from '@playwright/test'

// Mock session matching E2E_TEST_SESSION from src/lib/e2e-auth.ts
const MOCK_E2E_SESSION = {
  user: {
    name: 'E2E Test User',
    email: 'e2e-test@fossapp.local',
    image: '/default-avatar.png',
    group: 'E2E Testing',
    groupId: -1,
  },
  expires: '2099-12-31T23:59:59.999Z',
}

/**
 * Check if E2E auth is configured
 */
function isE2EAuthConfigured(): boolean {
  return Boolean(process.env.E2E_TEST_SECRET)
}

/**
 * Set up session mocking for a page
 */
async function setupSessionMocking(page: Page): Promise<void> {
  // Intercept NextAuth session endpoint
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_E2E_SESSION),
    })
  })

  // Also intercept providers endpoint to prevent real OAuth calls
  await page.route('**/api/auth/providers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        google: {
          id: 'google',
          name: 'Google',
          type: 'oauth',
          signinUrl: '/api/auth/signin/google',
          callbackUrl: '/api/auth/callback/google',
        },
      }),
    })
  })
}

/**
 * Extended test with E2E authentication fixtures
 *
 * Automatically mocks session when E2E_TEST_SECRET is configured.
 */
export const test = base.extend({
  // Override default page to include session mocking automatically
  page: async ({ page }, use) => {
    // Only mock session if E2E auth is configured
    if (isE2EAuthConfigured()) {
      await setupSessionMocking(page)
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture 'use', not React hook
    await use(page)
  },
})

// Re-export expect for convenience
export { expect }

/**
 * Helper to check if currently running with E2E auth
 */
export function hasE2EAuth(): boolean {
  return isE2EAuthConfigured()
}

/**
 * Skip test if E2E auth is not configured
 *
 * Usage:
 *   test('requires auth', async ({ page }) => {
 *     skipWithoutE2EAuth()
 *     // ... test code
 *   })
 */
export function skipWithoutE2EAuth(): void {
  if (!isE2EAuthConfigured()) {
    test.skip()
  }
}
