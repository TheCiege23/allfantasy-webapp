import { test, expect } from '@playwright/test'

const PROTECTED_ROUTES = [
  '/dynasty-trade-analyzer',
  '/af-legacy/pulse',
  '/strategy',
  '/compare',
  '/share',
  '/player-finder',
  '/af-legacy',
]

for (const route of PROTECTED_ROUTES) {
  test(`unauthenticated user visiting ${route} redirects to login`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(500)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
}

test('/rankings loads without auth (public route)', async ({ page }) => {
  const response = await page.goto('/rankings', { waitUntil: 'domcontentloaded' })
  expect(response?.status()).toBe(200)
  await expect(page.locator('text=Power Rankings')).toBeVisible({ timeout: 10_000 })
})

test('login page renders correctly', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('text=Sign In')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('input[placeholder*="email" i], input[placeholder*="username" i]').first()).toBeVisible()
  await expect(page.locator('input[type="password"]').first()).toBeVisible()
})
