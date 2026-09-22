// Playwright 端到端配置：显式启动构建预览服务器，仅运行 Chromium 桌面档
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  // 视觉基线统一存放 .generated/visual-baseline/baseline/，{arg} 即快照名（如 1440-dark-hero.png）。
  // 首轮基线经人工逐张比对确认后入库；更新基线必须人工审阅差异，不允许盲更新。
  snapshotPathTemplate: '.generated/visual-baseline/baseline/{arg}{ext}',
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    // CI（npm run verify 亦以 CI=1 调用）不复用已有服务，保证测到的是本次构建的新产物
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      // 本环境 Playwright CDN 不可达，使用系统已安装的 Chrome
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
})
