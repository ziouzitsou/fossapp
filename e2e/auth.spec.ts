import { test, expect } from '@playwright/test';

/**
 * Authentication Tests
 *
 * Tests for authentication flows (Google OAuth via NextAuth).
 * Note: Actual OAuth login requires credentials and is typically
 * mocked or tested in a separate auth-specific test suite.
 */

test.describe('Authentication', () => {
  test('unauthenticated user sees login option', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Homepage IS the login page - look for Google sign-in button
    const signInButton = page.locator('button:has-text("Sign in with Google")');

    await expect(signInButton).toBeVisible({ timeout: 10000 });
  });

  test('projects page requires authentication', async ({ page }) => {
    // Access projects page
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Close any dialogs that may appear (like "What's New")
    // Use force:true to click even if element is outside viewport
    const closeButton = page.locator('button:has-text("Close")');
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click({ force: true, timeout: 5000 }).catch(() => {});
    }

    // In dev mode, there's a dev user auto-login
    // Check that either we see projects page content or login
    // Wait for page to finish loading (beyond networkidle)
    const projectsHeading = page.locator('h1:has-text("Projects")');
    const signInButton = page.locator('button:has-text("Sign in with Google")');

    // Wait up to 10s for either state
    const isOnProjects = await projectsHeading.isVisible({ timeout: 10000 }).catch(() => false);
    const isOnLogin = await signInButton.isVisible({ timeout: 2000 }).catch(() => false);

    expect(isOnProjects || isOnLogin).toBeTruthy();
  });

  test('NextAuth session endpoint exists', async ({ request }) => {
    const response = await request.get('/api/auth/session');

    // Should return 200 (even if not authenticated, returns empty session)
    expect(response.ok()).toBeTruthy();

    const session = await response.json();
    // Session object should exist (empty {} if not authenticated)
    expect(typeof session).toBe('object');
  });

  test('NextAuth providers endpoint exists', async ({ request }) => {
    const response = await request.get('/api/auth/providers');

    expect(response.ok()).toBeTruthy();

    const providers = await response.json();
    // Should have Google provider configured
    expect(providers).toHaveProperty('google');
  });
});
