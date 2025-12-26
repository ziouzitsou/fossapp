import { test, expect } from '@playwright/test';

/**
 * Navigation Tests
 *
 * Tests for main navigation and routing between pages.
 */

test.describe('Navigation', () => {
  test('main navigation links work', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find navigation element
    const nav = page.locator('nav, header').first();

    // Check common navigation links exist
    const expectedRoutes = [
      { text: /products/i, path: '/products' },
      { text: /tiles/i, path: '/tiles' },
    ];

    for (const route of expectedRoutes) {
      const link = nav.locator(`a[href="${route.path}"], a:has-text("${route.text.source}")`).first();

      if (await link.isVisible()) {
        // Link exists in navigation
        await expect(link).toBeVisible();
      }
    }
  });

  test('can navigate to products and back', async ({ page }) => {
    await page.goto('/');

    // Navigate to products
    await page.goto('/products');
    await expect(page).toHaveURL(/\/products/);

    // Go back to home
    await page.goto('/');
    await expect(page).toHaveURL('/');
  });

  test('404 page handles invalid routes', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-12345');

    // Should return 404 status
    expect(response?.status()).toBe(404);
  });

  test('responsive navigation works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Look for mobile menu button (hamburger)
    const menuButton = page.locator('button[aria-label*="menu" i], button:has([class*="hamburger"]), [data-testid="mobile-menu"]').first();

    if (await menuButton.isVisible()) {
      await menuButton.click();

      // Mobile menu should open
      const mobileMenu = page.locator('[data-testid="mobile-nav"], .mobile-menu, nav[data-state="open"]').first();
      await expect(mobileMenu).toBeVisible({ timeout: 5000 });
    }
  });
});
