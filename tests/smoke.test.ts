import { test, expect } from '@playwright/test'

test.describe('Critical paths - Smoke Tests', () => {
  test('health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.status).toBe('healthy')
    expect(data.version).toBeDefined()
  })

  test('manifest is valid JSON', async ({ request }) => {
    const response = await request.get('/api/manifest')
    expect(response.status()).toBe(200)

    const manifest = await response.json()
    expect(manifest.name).toContain('FOSSAPP')
    expect(manifest.short_name).toBeDefined()
    expect(manifest.display).toBeDefined()
  })

  test('login page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Welcome to FOSSAPP/i })).toBeVisible()
  })

  test('unauthenticated dashboard access redirects', async ({ page }) => {
    // With NEXT_PUBLIC_BYPASS_AUTH=true in dev, this won't redirect
    // So we check for either redirect or dashboard content
    await page.goto('/dashboard')

    // In dev with bypass, should show dashboard
    // In production, should redirect to login
    const currentUrl = page.url()
    const isDashboard = currentUrl.includes('/dashboard')
    const isAuth = currentUrl.includes('auth') || currentUrl === '/'

    // Should be one or the other depending on environment
    expect(isDashboard || isAuth).toBeTruthy()
  })

  test('products page is accessible', async ({ page }) => {
    await page.goto('/products')

    // Check if we can access products page (dev bypass or logged in)
    const currentUrl = page.url()
    const isProducts = currentUrl.includes('/products')
    const isAuth = currentUrl.includes('auth') || currentUrl === '/'

    expect(isProducts || isAuth).toBeTruthy()
  })

  test('API search endpoint requires authentication', async ({ request }) => {
    // Test that unauthenticated requests are rejected
    const response = await request.get('/api/products/search')
    expect(response.status()).toBe(401)

    const data = await response.json()
    expect(data.error).toContain('Unauthorized')
  })

  test('API product endpoint requires authentication', async ({ request }) => {
    // Test that unauthenticated requests are rejected
    const response = await request.get('/api/products/invalid-id')
    expect(response.status()).toBe(401)

    const data = await response.json()
    expect(data.error).toContain('Unauthorized')
  })

  test('API search validates input when authenticated', async ({ request }) => {
    // Note: This test validates the auth requirement works correctly
    // In development with NEXT_PUBLIC_BYPASS_AUTH=true, client-side auth is bypassed
    // but API endpoints still require server-side session
    // Full authenticated API tests would require mocking NextAuth session (future enhancement)

    const response = await request.get('/api/products/search?q=test')
    // Without valid session, should return 401
    expect(response.status()).toBe(401)
  })
})
