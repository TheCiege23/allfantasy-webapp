import { test, expect } from '@playwright/test'

test('rankings page has Refresh AI Analysis button', async ({ page }) => {
  await page.goto('/rankings', { waitUntil: 'domcontentloaded' })
  const refreshBtn = page.locator('button', { hasText: /refresh/i })
  await expect(refreshBtn).toBeVisible({ timeout: 10_000 })
})

test('rankings page shows sample league heading', async ({ page }) => {
  await page.goto('/rankings', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('text=Sample League Power Rankings')).toBeVisible({ timeout: 10_000 })
})

test('rankings page shows sign-in prompt for unauthenticated users', async ({ page }) => {
  await page.goto('/rankings', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('text=Sign in')).toBeVisible({ timeout: 10_000 })
})
