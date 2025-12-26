import { test, expect, hasE2EAuth } from './fixtures';

/**
 * Tiles Feature Tests
 *
 * Tests for the Tile Management System (DWG generation).
 * The tiles page allows users to create tile groups and generate DWG files.
 *
 * Authentication:
 * - When E2E_TEST_SECRET is configured, tests run with auth bypass
 * - When not configured, tests check for proper auth protection
 *
 * @see e2e/fixtures.ts for session mocking implementation
 */

test.describe('Tiles Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tiles');
    await page.waitForLoadState('networkidle');
  });

  test('tiles page loads and shows main UI elements', async ({ page }) => {
    // Check if redirected to login or showing tiles page
    const isLoginPage = await page.locator('text=Sign in with Google').isVisible();

    if (isLoginPage) {
      // Tiles requires auth - verify redirect works
      await expect(page.locator('text=Welcome to FOSSAPP')).toBeVisible();
    } else {
      // Authenticated - verify tiles UI
      await expect(page.locator('body')).toBeVisible();

      // Look for key tiles UI elements
      const pageTitle = page.locator('h1, h2').filter({ hasText: /tile/i });
      const hasTileContent = await pageTitle.count() > 0;

      // Should have some tile-related content
      expect(hasTileContent || await page.locator('text=Tile').count() > 0).toBeTruthy();
    }
  });

  test('tiles page shows tile builder UI', async ({ page }) => {
    // Tiles page is public - should show the Tile Builder interface
    const tileBuilder = page.locator('text=Tile Builder');
    const bucket = page.locator('text=Bucket');
    const tiles = page.locator('h2:has-text("Tiles"), h3:has-text("Tiles")');

    // Should show at least one of these UI elements
    const hasUI = await tileBuilder.isVisible() ||
                  await bucket.isVisible() ||
                  await tiles.isVisible();

    expect(hasUI).toBeTruthy();

    // Verify Tile Builder heading
    await expect(tileBuilder).toBeVisible();
  });
});

test.describe('Tiles UI Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tiles');
    await page.waitForLoadState('networkidle');
  });

  test('bucket section is visible', async ({ page }) => {
    // Look for the Bucket heading (use first() to avoid strict mode)
    const bucketHeading = page.locator('text=Bucket').first();
    await expect(bucketHeading).toBeVisible();

    // Look for bucket instructions
    const bucketInstructions = page.locator('text=Search and add products').first();
    await expect(bucketInstructions).toBeVisible();
  });

  test('tiles canvas section is visible', async ({ page }) => {
    // Look for tile canvas area
    const tilesHeading = page.locator('h2:has-text("Tiles"), h3:has-text("Tiles")').first();
    const tileCanvas = page.locator('text=Tile Canvas');

    const hasTilesSection = await tilesHeading.isVisible() || await tileCanvas.isVisible();
    expect(hasTilesSection).toBeTruthy();

    // Look for drag instruction
    const dragInstruction = page.locator('text=Drag products here');
    await expect(dragInstruction).toBeVisible();
  });

  test('search input is functional', async ({ page }) => {
    // Look for product search
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();
    await expect(searchInput).toBeVisible();

    // Search button should be present
    const searchButton = page.locator('button:has-text("Search")');
    await expect(searchButton).toBeVisible();
  });
});

test.describe('Tiles Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('tiles page is responsive on mobile', async ({ page }) => {
    await page.goto('/tiles');
    await page.waitForLoadState('networkidle');

    // Page should load without horizontal scroll issues
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check viewport doesn't cause horizontal overflow
    const bodyWidth = await body.evaluate(el => el.scrollWidth);
    const viewportWidth = 375;

    // Allow small tolerance for scrollbars
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
  });
});
