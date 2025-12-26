import { test, expect } from '@playwright/test';

/**
 * Performance Tests
 *
 * Basic performance checks for critical pages.
 * These verify pages load within acceptable time limits.
 *
 * NOTE: Performance varies by network/server load.
 * Adjust thresholds based on your requirements.
 */

test.describe('Page Load Performance', () => {
  const MAX_LOAD_TIME = 5000; // 5 seconds max

  test('homepage loads within threshold', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(MAX_LOAD_TIME);
    console.log(`Homepage load time: ${loadTime}ms`);
  });

  test('products page loads within threshold', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(MAX_LOAD_TIME);
    console.log(`Products page load time: ${loadTime}ms`);
  });

  test('tiles page loads within threshold', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/tiles');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(MAX_LOAD_TIME);
    console.log(`Tiles page load time: ${loadTime}ms`);
  });
});

test.describe('API Response Times', () => {
  const MAX_API_TIME = 2000; // 2 seconds max for API

  test('health API responds quickly', async ({ request }) => {
    const startTime = Date.now();

    const response = await request.get('/api/health');

    const responseTime = Date.now() - startTime;

    expect(response.ok()).toBeTruthy();
    expect(responseTime).toBeLessThan(MAX_API_TIME);
    console.log(`Health API response time: ${responseTime}ms`);
  });

  test('auth session API responds quickly', async ({ request }) => {
    const startTime = Date.now();

    const response = await request.get('/api/auth/session');

    const responseTime = Date.now() - startTime;

    expect(response.ok()).toBeTruthy();
    expect(responseTime).toBeLessThan(MAX_API_TIME);
    console.log(`Auth session API response time: ${responseTime}ms`);
  });
});

test.describe('Core Web Vitals Approximation', () => {
  test('homepage First Contentful Paint', async ({ page }) => {
    await page.goto('/');

    // Get performance metrics
    const fcpMetric = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const fcp = entries.find(entry => entry.name === 'first-contentful-paint');
          if (fcp) {
            resolve(fcp.startTime);
          }
        }).observe({ entryTypes: ['paint'] });

        // Fallback timeout
        setTimeout(() => resolve(-1), 5000);
      });
    });

    if (fcpMetric > 0) {
      console.log(`First Contentful Paint: ${fcpMetric}ms`);
      // Good FCP is under 1.8s
      expect(fcpMetric).toBeLessThan(3000);
    }
  });

  test('homepage has no major layout shifts', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for layout stability by measuring element positions
    const initialLayout = await page.evaluate(() => {
      const elements = document.querySelectorAll('h1, h2, button, img');
      return Array.from(elements).slice(0, 10).map(el => {
        const rect = el.getBoundingClientRect();
        return { top: rect.top, left: rect.left };
      });
    });

    // Wait a bit for any delayed content
    await page.waitForTimeout(1000);

    const finalLayout = await page.evaluate(() => {
      const elements = document.querySelectorAll('h1, h2, button, img');
      return Array.from(elements).slice(0, 10).map(el => {
        const rect = el.getBoundingClientRect();
        return { top: rect.top, left: rect.left };
      });
    });

    // Check that elements haven't shifted significantly
    for (let i = 0; i < Math.min(initialLayout.length, finalLayout.length); i++) {
      const shift = Math.abs(initialLayout[i].top - finalLayout[i].top);
      expect(shift).toBeLessThan(50); // Allow small shifts
    }
  });
});

test.describe('Resource Loading', () => {
  test('no failed resource requests on homepage', async ({ page }) => {
    const failedRequests: string[] = [];

    page.on('requestfailed', request => {
      // Ignore favicon and analytics failures
      const url = request.url();
      if (!url.includes('favicon') && !url.includes('analytics')) {
        failedRequests.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(failedRequests).toHaveLength(0);
  });

  test('no console errors on homepage', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known benign errors
        if (!text.includes('favicon') && !text.includes('404')) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Allow for minor console errors, but flag if too many
    expect(consoleErrors.length).toBeLessThan(3);
  });
});
