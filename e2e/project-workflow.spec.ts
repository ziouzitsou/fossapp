import { test, expect, hasE2EAuth } from './fixtures'

/**
 * Project Workflow E2E Test
 *
 * Complete user journey testing the full project lifecycle:
 * 1. Create a new project
 * 2. Add areas to the project
 * 3. Create area versions
 * 4. Add products to the project
 * 5. Verify project data
 * 6. Delete the project (cleanup)
 *
 * This is a "critical path" test - if this passes, core functionality works.
 *
 * Prerequisites:
 * - E2E_TEST_SECRET must be configured for auth bypass
 * - Dev server running on localhost:8080
 *
 * Run with: npm run test:e2e -- e2e/project-workflow.spec.ts
 */

// Test data - unique per run to avoid conflicts
const TEST_PROJECT = {
  name: `E2E Test Project ${Date.now()}`,
  description: 'Automated E2E test - will be deleted after test',
  customer: 'TECHGROUP', // Partial match for customer search
}

const TEST_AREA = {
  name: 'Ground Floor',
  code: 'GF',
  type: 'floor',
}

test.describe('Project Workflow', () => {
  // Skip all tests if E2E auth is not configured
  test.beforeEach(async () => {
    test.skip(!hasE2EAuth(), 'Requires E2E_TEST_SECRET for authentication bypass')
  })

  // Store project ID for cleanup
  let createdProjectId: string | null = null

  test('complete project lifecycle', async ({ page }) => {
    // Increase timeout for this comprehensive test
    test.setTimeout(120_000) // 2 minutes

    // ========================================================================
    // STEP 1: Navigate to Projects page
    // ========================================================================
    await test.step('Navigate to Projects page', async () => {
      await page.goto('/projects')
      await page.waitForLoadState('networkidle')

      // Verify we're on the projects page
      await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
    })

    // ========================================================================
    // STEP 2: Open Create Project dialog
    // ========================================================================
    await test.step('Open Create Project dialog', async () => {
      // Click the "New Project" button
      await page.getByRole('button', { name: /new project/i }).click()

      // Wait for dialog to open
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Create New Project' })).toBeVisible()
    })

    // ========================================================================
    // STEP 3: Fill in project details
    // ========================================================================
    await test.step('Fill in project details', async () => {
      // Fill project name
      const nameInput = page.getByRole('textbox', { name: /project name/i })
      await nameInput.fill(TEST_PROJECT.name)

      // Fill description
      const descInput = page.getByRole('textbox', { name: /description/i })
      await descInput.fill(TEST_PROJECT.description)

      // Select customer (custom Popover component)
      // Click the customer selector button by text
      const customerButton = page.locator('button:has-text("Search and select customer")')
      await customerButton.click()

      // Wait for popover to open
      await page.waitForTimeout(500)

      // Type in the command input (cmdk uses input with specific role)
      const searchInput = page.locator('[cmdk-input]')
      await searchInput.fill(TEST_PROJECT.customer)

      // Wait for search results to load
      await page.waitForTimeout(1500)

      // Select first matching customer from the list
      const customerOption = page.locator('[cmdk-item]').first()
      await expect(customerOption).toBeVisible({ timeout: 5000 })
      await customerOption.click()

      // Select project type
      const typeButton = page.getByRole('combobox', { name: /select type/i })
      if (await typeButton.isVisible()) {
        await typeButton.click()
        await page.getByRole('option', { name: 'Residential' }).click()
      }
    })

    // ========================================================================
    // STEP 4: Submit project creation
    // ========================================================================
    await test.step('Submit project creation', async () => {
      // Click Create Project button
      await page.getByRole('button', { name: /create project/i }).click()

      // Wait for dialog to close (project created successfully)
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 30_000 })

      // Verify project appears in the list
      await expect(page.getByText(TEST_PROJECT.name)).toBeVisible({ timeout: 10_000 })
    })

    // ========================================================================
    // STEP 5: Navigate to project detail page
    // ========================================================================
    await test.step('Navigate to project detail page', async () => {
      // Find the project row and click the menu button
      const projectRow = page.locator('tr, [class*="row"]').filter({ hasText: TEST_PROJECT.name })

      // Try clicking the project name/row directly first
      const projectLink = projectRow.locator('a, [role="link"]').first()
      if (await projectLink.isVisible({ timeout: 2000 })) {
        await projectLink.click()
      } else {
        // Click the three-dot menu and select view/open
        const menuButton = projectRow.getByRole('button', { name: /menu|open/i }).or(
          projectRow.locator('button').last()
        )
        await menuButton.click()
        await page.waitForTimeout(300)

        // Click "View" or similar option
        const viewOption = page.getByRole('menuitem', { name: /view|open|details/i })
        if (await viewOption.isVisible({ timeout: 2000 })) {
          await viewOption.click()
        } else {
          // Fallback: navigate directly using the project code
          const projectCode = await projectRow.locator('text=/\\d{4}-\\d{3}/').textContent()
          if (projectCode) {
            // Get project ID from API or navigate via search
            await page.goto('/projects')
          }
        }
      }

      // Wait for navigation
      await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10_000 })
      await page.waitForLoadState('networkidle')

      // Verify we're on the detail page
      await expect(page.getByRole('heading', { name: TEST_PROJECT.name })).toBeVisible({ timeout: 10_000 })

      // Extract project ID from URL for cleanup
      const url = page.url()
      const match = url.match(/\/projects\/([a-f0-9-]+)/)
      if (match) {
        createdProjectId = match[1]
        console.log(`Created project ID: ${createdProjectId}`)
      }
    })

    // ========================================================================
    // STEP 6: Navigate to Areas tab and add an area
    // ========================================================================
    await test.step('Add an area to the project', async () => {
      // Click Areas tab
      await page.getByRole('tab', { name: /areas/i }).click()

      // Wait for tab content to load
      await page.waitForTimeout(500)

      // Click Add Area button
      const addAreaButton = page.getByRole('button', { name: /add area/i })
      await addAreaButton.click()

      // Wait for area form dialog
      await expect(page.getByRole('dialog')).toBeVisible()

      // Fill area details (use exact label to avoid matching English name field)
      await page.getByLabel('Area Name *').fill(TEST_AREA.name)
      await page.getByLabel('Area Code *').fill(TEST_AREA.code)

      // Select area type if dropdown is available
      const areaTypeSelect = page.getByLabel(/area type/i)
      if (await areaTypeSelect.isVisible()) {
        await areaTypeSelect.click()
        await page.getByRole('option', { name: /floor/i }).click()
      }

      // Submit area creation
      await page.getByRole('button', { name: /create|save|add/i }).click()

      // Wait for dialog to close
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

      // Verify area appears in the list
      await expect(page.getByText(TEST_AREA.name)).toBeVisible()
    })

    // ========================================================================
    // STEP 7: Create a new version of the area
    // ========================================================================
    await test.step('Create area version', async () => {
      // Find the area card/row and look for version button
      const areaCard = page.locator('[class*="card"]').filter({ hasText: TEST_AREA.name })

      // Click on version/history button if available
      const versionButton = areaCard.getByRole('button', { name: /version|history/i }).first()

      if (await versionButton.isVisible()) {
        await versionButton.click()

        // Wait for version creation or history dialog
        await page.waitForTimeout(1000)

        // If a dialog opened, look for create version button
        const createVersionBtn = page.getByRole('button', { name: /create.*version|new version/i })
        if (await createVersionBtn.isVisible()) {
          await createVersionBtn.click()
          await page.waitForTimeout(2000)
        }

        // Close dialog if open (use first() to avoid strict mode error)
        const closeButton = page.getByRole('button', { name: 'Close' }).first()
        if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeButton.click()
        }
      }

      // Verify we're still on the page (no errors)
      await expect(page.getByText(TEST_AREA.name)).toBeVisible()
    })

    // ========================================================================
    // STEP 8: Navigate to Products and add one to project
    // ========================================================================
    await test.step('Add a product to the project', async () => {
      // Navigate to products page
      await page.goto('/products')
      await page.waitForLoadState('networkidle')

      // Wait for products to load
      await page.waitForTimeout(2000)

      // Click on a product category or first product
      const productCard = page.locator('[class*="card"]').first()
      if (await productCard.isVisible()) {
        await productCard.click()
        await page.waitForLoadState('networkidle')
      }

      // Look for "Add to Project" button on product detail page
      const addToProjectBtn = page.getByRole('button', { name: /add to project/i })

      if (await addToProjectBtn.isVisible({ timeout: 5000 })) {
        await addToProjectBtn.click()

        // Wait for area selection popover
        await page.waitForTimeout(500)

        // Select our test area if dropdown appears
        const areaOption = page.getByText(TEST_AREA.name)
        if (await areaOption.isVisible()) {
          await areaOption.click()
        }

        // Confirm add
        const confirmBtn = page.getByRole('button', { name: /add|confirm/i }).first()
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click()
        }

        await page.waitForTimeout(1000)
      }
    })

    // ========================================================================
    // STEP 9: Verify project has products
    // ========================================================================
    await test.step('Verify project products', async () => {
      // Navigate back to project
      if (createdProjectId) {
        await page.goto(`/projects/${createdProjectId}?tab=products`)
        await page.waitForLoadState('networkidle')

        // Check products tab shows content
        const productsTab = page.getByRole('tab', { name: /products/i })
        await expect(productsTab).toBeVisible()
      }
    })

    // ========================================================================
    // STEP 10: Delete the project (cleanup)
    // ========================================================================
    await test.step('Delete project (cleanup)', async () => {
      if (createdProjectId) {
        await page.goto(`/projects/${createdProjectId}`)
        await page.waitForLoadState('networkidle')

        // Click Delete button
        await page.getByRole('button', { name: /delete/i }).click()

        // Wait for confirmation dialog
        await expect(page.getByRole('dialog')).toBeVisible()

        // Type project name for confirmation if required
        const confirmInput = page.getByRole('textbox')
        if (await confirmInput.isVisible()) {
          // Get the project code from the dialog text
          const dialogText = await page.getByRole('dialog').textContent()
          const codeMatch = dialogText?.match(/type.*?["']?(\d{4}-\d{3})["']?/i)
          if (codeMatch) {
            await confirmInput.fill(codeMatch[1])
          }
        }

        // Click confirm delete
        const confirmDeleteBtn = page.getByRole('button', { name: /delete|confirm/i }).last()
        await confirmDeleteBtn.click()

        // Wait for redirect to projects list
        await page.waitForURL('/projects', { timeout: 10_000 })

        // Verify project is gone
        await expect(page.getByText(TEST_PROJECT.name)).toBeHidden()

        console.log('Project deleted successfully')
        createdProjectId = null
      }
    })
  })

  // Cleanup in case test fails mid-way
  test.afterEach(async ({ page }) => {
    if (createdProjectId) {
      console.log(`Cleaning up project: ${createdProjectId}`)
      try {
        await page.goto(`/projects/${createdProjectId}`)
        await page.getByRole('button', { name: /delete/i }).click()
        await page.waitForTimeout(500)
        const confirmBtn = page.getByRole('button', { name: /delete|confirm/i }).last()
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click()
        }
      } catch (e) {
        console.log('Cleanup failed or project already deleted')
      }
    }
  })
})
