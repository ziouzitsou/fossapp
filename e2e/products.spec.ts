import { test, expect, hasE2EAuth } from './fixtures';

/**
 * Product Search Tests
 *
 * Tests for the main product search functionality.
 * FOSSAPP has 56K+ products with advanced filtering.
 *
 * Authentication:
 * - When E2E_TEST_SECRET is configured, tests run with auth bypass
 * - When not configured, auth-dependent tests are skipped
 *
 * @see e2e/fixtures.ts for session mocking implementation
 * @see docs/testing/e2e-auth-bypass.md for setup instructions
 */

test.describe('Product Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
  });

  test('products page requires authentication when not bypassed', async ({ page }) => {
    // This test verifies auth protection when E2E bypass is NOT configured
    test.skip(hasE2EAuth(), 'Skipping auth check when E2E bypass is active');

    // Products page is protected - should redirect to login or show auth prompt
    const signInButton = page.locator('text=Sign in with Google');
    const welcomeText = page.locator('text=Welcome to FOSSAPP');

    const isLoginPage = await signInButton.isVisible() || await welcomeText.isVisible();
    expect(isLoginPage).toBeTruthy();

    // Verify login button is present
    await expect(signInButton).toBeVisible();
  });

  test('products page loads with categories when authenticated', async ({ page }) => {
    // This test verifies the page works when authenticated
    test.skip(!hasE2EAuth(), 'Requires E2E_TEST_SECRET for authentication bypass');

    // With auth bypass, we should see the products page content
    const categoriesHeading = page.locator('h2:has-text("Product Categories")');

    // Wait for content to load
    await expect(categoriesHeading).toBeVisible({ timeout: 10000 });
  });

  test('category cards are displayed when authenticated', async ({ page }) => {
    test.skip(!hasE2EAuth(), 'Requires E2E_TEST_SECRET for authentication bypass');

    // Wait for page to fully load
    await page.waitForTimeout(1000);

    // Verify category cards are displayed (Luminaires, Accessories, Drivers, etc.)
    const luminaires = page.getByText('Luminaires').first();
    const accessories = page.getByText('Accessories').first();

    await expect(luminaires).toBeVisible({ timeout: 10000 });
    await expect(accessories).toBeVisible();

    // Verify product counts are shown
    const productCount = page.getByText(/\d+.*products/i).first();
    await expect(productCount).toBeVisible();
  });

  test('filters panel shows supplier options when authenticated', async ({ page }) => {
    test.skip(!hasE2EAuth(), 'Requires E2E_TEST_SECRET for authentication bypass');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // The products page shows a Filters section - look for specific supplier names
    const deltaLight = page.getByText('Delta Light').first();
    const meyerLighting = page.getByText('Meyer Lighting').first();

    // At least one supplier should be visible
    const hasSuppliers = await deltaLight.isVisible() || await meyerLighting.isVisible();
    expect(hasSuppliers).toBeTruthy();
  });
});
