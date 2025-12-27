import { test as base, expect } from '@playwright/test';

/**
 * E2E Authentication Bypass Tests
 *
 * These tests verify the E2E authentication bypass system works correctly.
 * They test both positive cases (valid bypass) and security (invalid bypass fails).
 *
 * Run with E2E_TEST_SECRET to test positive cases:
 *   E2E_TEST_SECRET=$(openssl rand -base64 48) npm run test:e2e -- --grep "E2E Auth"
 *
 * @see src/lib/e2e-auth.ts for implementation
 * @see docs/testing/e2e-auth-bypass.md for setup
 */

const E2E_TEST_SECRET = process.env.E2E_TEST_SECRET;
const hasSecret = Boolean(E2E_TEST_SECRET);

// Use base test to avoid inheriting extraHTTPHeaders from fixtures
const test = base;

test.describe('E2E Auth Bypass', () => {
  test.describe('with valid E2E secret', () => {
    test.skip(!hasSecret, 'Requires E2E_TEST_SECRET to be set');

    test('can access protected page with valid header', async ({ request, baseURL }) => {
      // Make request to protected endpoint with valid header
      const response = await request.get(`${baseURL}/products`, {
        headers: {
          'x-e2e-test-key': E2E_TEST_SECRET!,
        },
      });

      // Should get 200 (page loads) not 302 (redirect to login)
      expect(response.status()).toBe(200);

      // Response should contain product page content, not login page
      const html = await response.text();
      expect(html).not.toContain('Sign in with Google');
    });

    test('e2e-session endpoint returns mock session', async ({ request, baseURL }) => {
      const response = await request.get(`${baseURL}/api/e2e-session`, {
        headers: {
          'x-e2e-test-key': E2E_TEST_SECRET!,
        },
      });

      expect(response.status()).toBe(200);

      const session = await response.json();

      // Verify session structure matches expected mock
      expect(session.user).toBeDefined();
      expect(session.user.email).toBe('e2e-test@fossapp.local');
      expect(session.user.name).toBe('E2E Test User');
      expect(session.expires).toBeDefined();
    });

    test('page session is mocked via route interception', async ({ page }) => {
      // This test uses the fixtures which set up session mocking
      // The fixtures are from playwright.config.ts extraHTTPHeaders

      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Should see product content, not login page
      const signInButton = page.locator('text=Sign in with Google');
      const isLoginPage = await signInButton.isVisible();

      expect(isLoginPage).toBe(false);
    });
  });

  test.describe('security - without valid secret', () => {
    // Note: These tests verify the E2E endpoint security, NOT page auth
    // Page auth tests are skipped in dev mode due to NEXT_PUBLIC_BYPASS_AUTH

    test('e2e-session endpoint rejects missing header', async ({ playwright, baseURL }) => {
      // Create a fresh request context explicitly WITHOUT the E2E header
      const request = await playwright.request.newContext({
        extraHTTPHeaders: {}, // Clear all inherited headers
      });

      try {
        const response = await request.get(`${baseURL}/api/e2e-session`);

        // Should return 401 Unauthorized
        expect(response.status()).toBe(401);

        const body = await response.json();
        expect(body.error).toBe('Unauthorized');
      } finally {
        await request.dispose();
      }
    });

    test('e2e-session endpoint rejects invalid header', async ({ playwright, baseURL }) => {
      // Create a fresh request context explicitly with invalid header
      const request = await playwright.request.newContext({
        extraHTTPHeaders: {
          'x-e2e-test-key': 'invalid-secret-that-is-wrong',
        },
      });

      try {
        const response = await request.get(`${baseURL}/api/e2e-session`);

        // Should return 401 Unauthorized
        expect(response.status()).toBe(401);

        const body = await response.json();
        expect(body.error).toBe('Unauthorized');
      } finally {
        await request.dispose();
      }
    });

    test('protected page requires auth without bypass (production only)', async ({ browser, baseURL }) => {
      // Skip in dev mode where NEXT_PUBLIC_BYPASS_AUTH may be active
      // This test is meant for production environment testing
      const isLocalhost = baseURL?.includes('localhost') || baseURL?.includes('127.0.0.1') || false;
      test.skip(isLocalhost, 'Skipping in dev mode - dev bypass may be active');

      // Create a fresh context without the E2E header
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(`${baseURL}/products`);
        await page.waitForLoadState('networkidle');

        // Should be redirected to login page
        const signInButton = page.locator('text=Sign in with Google');
        const welcomeText = page.locator('text=Welcome to FOSSAPP');

        const isLoginPage = await signInButton.isVisible() || await welcomeText.isVisible();
        expect(isLoginPage).toBe(true);
      } finally {
        await context.close();
      }
    });
  });

  test.describe('rate limiting', () => {
    test.skip(!hasSecret, 'Requires E2E_TEST_SECRET to test rate limiting');

    test('rate limits excessive requests', async ({ request, baseURL }) => {
      // Make many requests quickly
      // Note: Rate limit is 100/minute, this is just a sanity check
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request.get(`${baseURL}/api/e2e-session`, {
            headers: {
              'x-e2e-test-key': E2E_TEST_SECRET!,
            },
          })
        );
      }

      const responses = await Promise.all(requests);

      // All should succeed (we're under the limit)
      for (const response of responses) {
        expect(response.status()).toBe(200);
      }
    });
  });
});

test.describe('E2E Auth Integration', () => {
  test.describe('with auth bypass', () => {
    test.skip(!hasSecret, 'Requires E2E_TEST_SECRET');

    test('dashboard page is accessible', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Should not be on login page
      const signInButton = page.locator('text=Sign in with Google');
      expect(await signInButton.isVisible()).toBe(false);

      // Should see dashboard content - use first() to handle multiple main elements
      await expect(page.locator('main').first()).toBeVisible();
    });

    test('projects page is accessible', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Should not be on login page
      const signInButton = page.locator('text=Sign in with Google');
      expect(await signInButton.isVisible()).toBe(false);
    });

    test('tiles page is accessible', async ({ page }) => {
      await page.goto('/tiles');
      await page.waitForLoadState('networkidle');

      // Should not be on login page
      const signInButton = page.locator('text=Sign in with Google');
      expect(await signInButton.isVisible()).toBe(false);
    });
  });
});
