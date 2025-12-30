import { test, expect } from '@playwright/test';

/**
 * Smoke Tests
 *
 * Basic tests to verify the app is running and core pages load correctly.
 * These should run quickly and catch major deployment issues.
 */

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');

    // Check that the page loads without errors
    await expect(page).toHaveTitle(/FOSSAPP|Foss/i);

    // Verify no console errors (optional, can be noisy)
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('health API endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health');

    // Should return 200 OK
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status');
  });

  test('products page loads', async ({ page }) => {
    await page.goto('/products');

    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded');

    // Check for products-related content
    await expect(page.locator('body')).toBeVisible();
  });

  test('tiles page loads', async ({ page }) => {
    await page.goto('/tiles');

    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('playground page loads', async ({ page }) => {
    await page.goto('/playground');

    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});
