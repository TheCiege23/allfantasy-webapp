import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5000',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    },
  },
  webServer: undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test-results' }]],
})
