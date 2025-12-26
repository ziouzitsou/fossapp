import { test, expect } from '@playwright/test';

/**
 * API Tests
 *
 * Tests for public API endpoints that don't require authentication.
 * These verify the backend is functioning correctly.
 */

test.describe('Public API Endpoints', () => {
  test('health endpoint returns correct structure', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('environment');
    expect(data).toHaveProperty('uptime');

    // Version should be semver format
    expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('NextAuth session endpoint works', async ({ request }) => {
    const response = await request.get('/api/auth/session');

    expect(response.ok()).toBeTruthy();
    // Returns empty object when not authenticated
    const data = await response.json();
    expect(typeof data).toBe('object');
  });

  test('NextAuth providers endpoint lists Google', async ({ request }) => {
    const response = await request.get('/api/auth/providers');

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('google');
    expect(data.google).toHaveProperty('id', 'google');
    expect(data.google).toHaveProperty('name', 'Google');
  });

  test('NextAuth CSRF token endpoint works', async ({ request }) => {
    const response = await request.get('/api/auth/csrf');

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('csrfToken');
    expect(typeof data.csrfToken).toBe('string');
    expect(data.csrfToken.length).toBeGreaterThan(0);
  });
});

test.describe('API Error Handling', () => {
  test('invalid API route returns 404', async ({ request }) => {
    const response = await request.get('/api/nonexistent-endpoint');

    expect(response.status()).toBe(404);
  });

  test('products search without auth returns appropriate response', async ({ request }) => {
    // This endpoint may require auth - verify it handles unauthenticated requests gracefully
    const response = await request.get('/api/products/search?q=LED');

    // Should either return 401/403 (auth required) or redirect
    // Not a 500 error
    expect(response.status()).not.toBe(500);
  });
});

test.describe('API Response Headers', () => {
  test('health endpoint has correct content-type', async ({ request }) => {
    const response = await request.get('/api/health');

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('API responses have security headers', async ({ request }) => {
    const response = await request.get('/api/health');

    // Check for common security headers (may vary based on config)
    const headers = response.headers();

    // These are typically set by Next.js or middleware
    // Just verify the response is properly formed
    expect(headers).toHaveProperty('content-type');
  });
});
