// 独立整页截图脚本：假定构建预览服务器已在 http://127.0.0.1:4173/ 运行，
// 可用环境变量 PREVIEW_URL 覆盖目标地址。用法：node scripts/screenshot.mjs
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const baseURL = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173/'
const outputDir = '.generated/screenshots'

// 截图场景清单：名称、视口宽高、注入的主题偏好。
// dpr2 场景仅把设备像素密度设为 2（deviceScaleFactor: 2），用于高清渲染检查；
// 像素密度不等于浏览器缩放，真实 200% 缩放须另行手动验证（见 docs/04 A04）。
const scenarios = [
  { name: 'desktop-1440-light', width: 1440, height: 900, theme: 'light' },
  { name: 'desktop-1440-dark', width: 1440, height: 900, theme: 'dark' },
  { name: 'tablet-768-dark', width: 768, height: 1024, theme: 'dark' },
  { name: 'mobile-390-light', width: 390, height: 844, theme: 'light' },
  { name: 'mobile-390-dark', width: 390, height: 844, theme: 'dark' },
  { name: 'narrow-320-light', width: 320, height: 680, theme: 'light' },
  { name: 'dpr2-light', width: 720, height: 450, theme: 'light', deviceScaleFactor: 2 },
]

mkdirSync(outputDir, { recursive: true })

// 本环境 Playwright CDN 不可达，使用系统已安装的 Chrome
const browser = await chromium.launch({ channel: 'chrome' })

try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      deviceScaleFactor: scenario.deviceScaleFactor ?? 1,
    })
    // 在页面任何脚本执行前写入主题偏好，保证首帧即目标主题（light 场景也显式注入，避免宿主系统深色偏好干扰）
    await context.addInitScript((pref) => {
      try {
        localStorage.setItem('personal-home:theme', pref)
      } catch {}
    }, scenario.theme)
    const page = await context.newPage()
    await page.goto(baseURL, { waitUntil: 'networkidle' })
    await page.screenshot({ path: `${outputDir}/${scenario.name}.png`, fullPage: true })
    await context.close()
  }
} finally {
  await browser.close()
}

console.log(`整页截图完成：${scenarios.length} 个场景已输出至 ${outputDir}/`)
