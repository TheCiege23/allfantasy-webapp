import { test, expect } from "@playwright/test"

test.describe("Golden Path: Legacy Hub tabs", () => {
  test("/af-legacy tabs are accessible (redirects unauthenticated)", async ({ page }) => {
    const tabs = ["/af-legacy", "/af-legacy/pulse"]
    for (const tab of tabs) {
      const res = await page.goto(tab, { waitUntil: "domcontentloaded" })
      expect(res?.status()).toBeLessThan(500)
    }
  })
})

test.describe("Golden Path: Rankings feature parity", () => {
  test("/rankings shows Power Rankings heading and Refresh button", async ({ page }) => {
    await page.goto("/rankings", { waitUntil: "domcontentloaded" })
    await expect(
      page.getByRole("heading", { name: /power rankings/i }).first()
    ).toBeVisible({ timeout: 10_000 })
    const refreshBtn = page.locator("button", { hasText: /refresh/i })
    await expect(refreshBtn).toBeVisible({ timeout: 10_000 })
  })

  test("/rankings loads without 500 and renders hero", async ({ page }) => {
    const res = await page.goto("/rankings", { waitUntil: "domcontentloaded" })
    expect(res?.status()).toBe(200)
    await expect(page.locator("text=Your League Right Now").first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe("Golden Path: Direct route fallbacks (B matrix)", () => {
  test("/dynasty-trade-analyzer loads or redirects (auth-gated)", async ({ page }) => {
    const res = await page.goto("/dynasty-trade-analyzer", { waitUntil: "domcontentloaded" })
    expect(res?.status()).toBeLessThan(500)
    const url = page.url()
    expect(url.includes("/dynasty-trade-analyzer") || url.includes("/login")).toBe(true)
  })

  test("/strategy page loads or redirects (auth-gated)", async ({ page }) => {
    const res = await page.goto("/strategy", { waitUntil: "domcontentloaded" })
    expect(res?.status()).toBeLessThan(500)
    const url = page.url()
    expect(url.includes("/strategy") || url.includes("/login")).toBe(true)
  })

  test("/player-finder redirects unauthenticated to login", async ({ page }) => {
    const res = await page.goto("/player-finder", { waitUntil: "domcontentloaded" })
    expect(res?.status()).toBeLessThan(500)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test("/compare redirects unauthenticated to login", async ({ page }) => {
    const res = await page.goto("/compare", { waitUntil: "domcontentloaded" })
    expect(res?.status()).toBeLessThan(500)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test("/share redirects unauthenticated to login", async ({ page }) => {
    const res = await page.goto("/share", { waitUntil: "domcontentloaded" })
    expect(res?.status()).toBeLessThan(500)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})

test.describe("Golden Path: Critical backend (C matrix)", () => {
  test("POST /api/legacy/transfer returns 401 unauthenticated (not 500 FK crash)", async ({ request }) => {
    const res = await request.post("/api/legacy/transfer", {
      data: { sleeperUsername: "test_user" },
    })
    expect(res.status()).not.toBe(500)
    expect([400, 401, 403]).toContain(res.status())
  })

  test("POST /api/legacy/transfer with leagueId returns 401 (not FK error)", async ({ request }) => {
    const res = await request.post("/api/legacy/transfer", {
      data: { leagueId: "1234567890" },
    })
    expect(res.status()).not.toBe(500)
    expect([400, 401, 403]).toContain(res.status())
  })

  test("POST /api/trade-finder returns non-500 for unauthenticated", async ({ request }) => {
    const res = await request.post("/api/trade-finder", {
      data: { league_id: "test", user_roster_id: 1 },
    })
    expect(res.status()).not.toBe(500)
    expect([400, 401, 403, 404]).toContain(res.status())
  })

  test("POST /api/strategy/generate returns 401 unauthenticated", async ({ request }) => {
    const res = await request.post("/api/strategy/generate", {
      data: { leagueId: "test" },
    })
    expect(res.status()).not.toBe(500)
    expect([401, 403]).toContain(res.status())
  })

  test("GET /api/health returns 200 with ok status", async ({ request }) => {
    const res = await request.get("/api/health")
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ok")
  })
})
