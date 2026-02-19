import { test, expect } from '@playwright/test'

const HEALTH_ENDPOINTS = [
  '/api/health',
]

for (const endpoint of HEALTH_ENDPOINTS) {
  test(`${endpoint} returns 200`, async ({ request }) => {
    const response = await request.get(endpoint)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
  })
}

const CRITICAL_API_ENDPOINTS = [
  { path: '/api/legacy/transfer', method: 'POST' as const },
  { path: '/api/trade-finder', method: 'POST' as const },
  { path: '/api/league/list', method: 'GET' as const },
]

for (const { path, method } of CRITICAL_API_ENDPOINTS) {
  test(`${path} returns 401 for unauthenticated requests (not 500)`, async ({ request }) => {
    const response = method === 'GET'
      ? await request.get(path)
      : await request.post(path, { data: {} })
    expect(response.status()).not.toBe(500)
    expect([401, 400, 403]).toContain(response.status())
  })
}
