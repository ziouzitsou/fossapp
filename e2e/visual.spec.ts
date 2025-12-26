import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 *
 * These tests capture screenshots and compare against baselines.
 * Run with --update-snapshots to create/update baseline images.
 *
 * Usage:
 *   npx playwright test e2e/visual.spec.ts --update-snapshots  # Create baselines
 *   npx playwright test e2e/visual.spec.ts                      # Compare against baselines
 *
 * NOTE: Visual tests should run against a consistent environment (production recommended)
 * to avoid false positives from dev server differences.
 */

test.describe('Visual Regression - Public Pages', () => {
  // Use consistent viewport for visual tests
  test.use({ viewport: { width: 1280, height: 720 } });

  test('homepage visual', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for any animations to settle
    await page.waitForTimeout(500);

    // Take full page screenshot
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      // Allow small pixel differences (anti-aliasing, fonts)
      maxDiffPixelRatio: 0.02,
    });
  });

  test('login page visual', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Focus on login card area
    const loginCard = page.locator('text=Welcome to FOSSAPP').locator('..');

    if (await loginCard.isVisible()) {
      await expect(loginCard).toHaveScreenshot('login-card.png', {
        maxDiffPixelRatio: 0.02,
      });
    }
  });
});

test.describe('Visual Regression - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('homepage mobile visual', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual Regression - Dark Mode', () => {
  test.use({
    viewport: { width: 1280, height: 720 },
    colorScheme: 'dark',
  });

  test('homepage dark mode visual', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('homepage-dark.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual Regression - Components', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('404 page visual', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('404-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual Regression - Protected Pages (Login State)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('products page redirect visual', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Should show login page (redirect from protected route)
    await expect(page).toHaveScreenshot('products-unauthenticated.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('tiles page redirect visual', async ({ page }) => {
    await page.goto('/tiles');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('tiles-unauthenticated.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('projects page redirect visual', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('projects-unauthenticated.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
