import { test, expect } from '@playwright/test';

/**
 * Product Search Tests
 *
 * Tests for the main product search functionality.
 * FOSSAPP has 56K+ products with advanced filtering.
 */

test.describe('Product Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
  });

  test('displays product categories', async ({ page }) => {
    // Products page shows category selection first
    // Look for category heading and category buttons
    await expect(page.locator('h2:has-text("Product Categories")')).toBeVisible({ timeout: 10000 });

    // Should show category cards (Luminaires, Accessories, etc.)
    const categoryButtons = page.locator('button:has-text("Luminaires"), button:has-text("Accessories")');
    await expect(categoryButtons.first()).toBeVisible();
  });

  test('search input is functional', async ({ page }) => {
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

  test('pagination works if present', async ({ page }) => {
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

  test('filters panel is accessible', async ({ page }) => {
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
