import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for FOSSAPP
 *
 * Run tests:
 *   npm run test:e2e          # Run all E2E tests
 *   npm run test:e2e:ui       # Run with Playwright UI
 *   npm run test:e2e:headed   # Run with visible browser
 *
 * E2E Authentication:
 *   Tests use a secure header bypass for authentication.
 *   Set E2E_TEST_SECRET env var to enable authenticated tests.
 *   See docs/testing/e2e-auth-bypass.md for details.
 *
 * WSL2 Compatibility:
 *   GPU acceleration is disabled by default for WSL2/Windows 10 compatibility.
 *   This enables non-headless mode to work correctly with CPU rendering.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

// E2E test secret for authenticated tests
const E2E_TEST_SECRET = process.env.E2E_TEST_SECRET;

// WSL2/Windows 10 compatibility: Disable GPU and force CPU rendering
// This fixes non-headless mode issues where GPU acceleration doesn't work
const WSL_CHROMIUM_ARGS = [
  '--disable-gpu',
  '--disable-gpu-compositing',
  '--disable-software-rasterizer',
  '--use-gl=swiftshader',
];

export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit parallel workers on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',

    // E2E auth header - added to all requests when secret is configured
    ...(E2E_TEST_SECRET && {
      extraHTTPHeaders: {
        'x-e2e-test-key': E2E_TEST_SECRET,
      },
    }),
  },

  // Test projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: WSL_CHROMIUM_ARGS,
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            // WSL2 compatibility: Disable GPU acceleration
            'layers.acceleration.disabled': true,
            'gfx.webrender.all': false,
            'gfx.webrender.enabled': false,
          },
        },
      },
    },
    // WebKit disabled - slow and not needed for this project
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Mobile viewports
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          args: WSL_CHROMIUM_ARGS,
        },
      },
    },
    // Mobile Safari disabled - uses WebKit
    // {
    //   name: 'mobile-safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Run local dev server before starting tests (optional)
  // Uncomment if you want Playwright to start the dev server automatically
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:8080',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },

  // Global timeout settings
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
  },
});
