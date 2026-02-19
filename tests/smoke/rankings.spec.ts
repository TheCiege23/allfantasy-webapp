import { test, expect } from '@playwright/test'

test('rankings page has Refresh AI Analysis button', async ({ page }) => {
  await page.goto('/rankings', { waitUntil: 'domcontentloaded' })
  const refreshBtn = page.locator('button', { hasText: /refresh/i })
  await expect(refreshBtn).toBeVisible({ timeout: 10_000 })
})

test('rankings page shows a league power rankings heading', async ({ page }) => {
  await page.goto('/rankings', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /power rankings/i }).first()).toBeVisible({ timeout: 10_000 })
})

test('rankings page renders hero section', async ({ page }) => {
  await page.goto('/rankings', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('text=Your League Right Now').first()).toBeVisible({ timeout: 10_000 })
})
