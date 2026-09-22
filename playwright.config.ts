import { defineConfig } from '@playwright/test'

/**
 * 浏览器测试只跑系统 Chrome：不依赖 `npx playwright install` 下载的内核，
 * 与既有站点的验证方式一致。多浏览器 projects 由第四阶段 S4-T6 一次性扩展。
 * 视觉基线由第四阶段 S4-T4 定为 tests/visual-baseline/，本阶段不建立基线。
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
