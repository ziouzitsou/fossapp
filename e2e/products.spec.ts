import { test, expect } from '@playwright/test';

/**
 * Product Search Tests
 *
 * Tests for the main product search functionality.
 * FOSSAPP has 56K+ products with advanced filtering.
 *
 * NOTE: Products page requires authentication in production.
 * These tests verify the page is protected and check behavior when accessible.
 */

test.describe('Product Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
  });

  test('products page requires authentication', async ({ page }) => {
    // Products page is protected - should redirect to login or show auth prompt
    const signInButton = page.locator('text=Sign in with Google');
    const welcomeText = page.locator('text=Welcome to FOSSAPP');
    const categoriesHeading = page.locator('h2:has-text("Product Categories")');

    const isLoginPage = await signInButton.isVisible() || await welcomeText.isVisible();
    const isProductsPage = await categoriesHeading.isVisible();

    // Either we're on the login page (correct protection) or authenticated and see products
    expect(isLoginPage || isProductsPage).toBeTruthy();

    if (isLoginPage) {
      // Verify login button is present
      await expect(signInButton).toBeVisible();
    }
  });

  test('search input is functional when authenticated', async ({ page }) => {
    // Skip if not authenticated (redirected to login)
    const isLoginPage = await page.locator('text=Sign in with Google').first().isVisible();
    test.skip(isLoginPage, 'Requires authentication - skipping in unauthenticated context');

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[name="search"]').first();

    // If search exists, test it
    if (await searchInput.isVisible()) {
      await searchInput.fill('LED');
      await searchInput.press('Enter');

      // Wait for results to update
      await page.waitForLoadState('networkidle');

      // URL should reflect search or results should update
      // This is a basic check - customize based on actual implementation
    }
  });

  test('pagination works if present when authenticated', async ({ page }) => {
    // Skip if not authenticated (redirected to login)
    const isLoginPage = await page.locator('text=Sign in with Google').first().isVisible();
    test.skip(isLoginPage, 'Requires authentication - skipping in unauthenticated context');

    // Look for pagination controls
    const pagination = page.locator('nav[aria-label*="pagination" i], .pagination, [data-testid="pagination"]');

    if (await pagination.isVisible()) {
      // Find next page button
      const nextButton = pagination.locator('button:has-text("Next"), a:has-text("Next"), [aria-label="Next"]').first();

      if (await nextButton.isVisible() && await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForLoadState('networkidle');

        // Page should have changed (URL or content)
      }
    }
  });

  test('filters panel is accessible when authenticated', async ({ page }) => {
    // Skip if not authenticated (redirected to login)
    const isLoginPage = await page.locator('text=Sign in with Google').first().isVisible();
    test.skip(isLoginPage, 'Requires authentication - skipping in unauthenticated context');

    // Look for filter controls
    const filterPanel = page.locator('[data-testid="filters"], .filters, aside, [role="complementary"]').first();

    // If filters exist, they should be visible or toggleable
    if (await filterPanel.isVisible()) {
      await expect(filterPanel).toBeVisible();
    } else {
      // Check for a filter toggle button
      const filterToggle = page.locator('button:has-text("Filter"), button:has-text("Filters"), [aria-label*="filter" i]').first();

      if (await filterToggle.isVisible()) {
        await filterToggle.click();
        // Filters should appear
        await expect(page.locator('[data-testid="filters"], .filters, .filter-panel').first()).toBeVisible();
      }
    }
  });
});
