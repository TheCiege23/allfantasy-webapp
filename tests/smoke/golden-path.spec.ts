import { test, expect } from "@playwright/test"

test.describe("Golden Path: Signed-in user features", () => {
  test("/af-legacy tabs are accessible (redirects unauthenticated)", async ({ page }) => {
    const tabs = ["/af-legacy", "/af-legacy/pulse"]
    for (const tab of tabs) {
      const res = await page.goto(tab, { waitUntil: "domcontentloaded" })
      expect(res?.status()).toBeLessThan(500)
    }
  })

  test("/rankings page loads and shows content", async ({ page }) => {
    await page.goto("/rankings", { waitUntil: "domcontentloaded" })
    await expect(
      page.getByRole("heading", { name: /power rankings/i }).first()
    ).toBeVisible({ timeout: 10_000 })
    const refreshBtn = page.locator("button", { hasText: /refresh/i })
    await expect(refreshBtn).toBeVisible({ timeout: 10_000 })
  })

  test("/dynasty-trade-analyzer loads or redirects (auth-gated)", async ({
    page,
  }) => {
    const res = await page.goto("/dynasty-trade-analyzer", {
      waitUntil: "domcontentloaded",
    })
    expect(res?.status()).toBeLessThan(500)
    const url = page.url()
    const isOnPage =
      url.includes("/dynasty-trade-analyzer") || url.includes("/login")
    expect(isOnPage).toBe(true)
  })

  test("/strategy page loads or redirects (auth-gated)", async ({ page }) => {
    const res = await page.goto("/strategy", {
      waitUntil: "domcontentloaded",
    })
    expect(res?.status()).toBeLessThan(500)
    const url = page.url()
    const isOnPage = url.includes("/strategy") || url.includes("/login")
    expect(isOnPage).toBe(true)
  })
})

test.describe("Golden Path: API auth guards", () => {
  test("POST /api/legacy/transfer returns auth error (not 500)", async ({
    request,
  }) => {
    const res = await request.post("/api/legacy/transfer", {
      data: { sleeperUsername: "test_user" },
    })
    expect(res.status()).not.toBe(500)
    expect([400, 401, 403]).toContain(res.status())
  })

  test("POST /api/trade-finder returns auth error (not 500)", async ({
    request,
  }) => {
    const res = await request.post("/api/trade-finder", {
      data: { leagueId: "test" },
    })
    expect(res.status()).not.toBe(500)
    expect([400, 401, 403]).toContain(res.status())
  })

  test("POST /api/strategy/generate returns auth error (not 500)", async ({
    request,
  }) => {
    const res = await request.post("/api/strategy/generate", {
      data: { leagueId: "test" },
    })
    expect(res.status()).not.toBe(500)
    expect([401, 403]).toContain(res.status())
  })
})

test.describe("Golden Path: Share flow", () => {
  test("/share redirects unauthenticated user to login (not 500)", async ({
    page,
  }) => {
    const res = await page.goto("/share", { waitUntil: "domcontentloaded" })
    expect(res?.status()).toBeLessThan(500)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})
