/// <reference types="node" />
// 视觉基线断言（T3 产出对照图 → T8 起改为 toHaveScreenshot 硬断言，转来收尾项 3）：
// 固定本地日期与减少动画，等待字体与实际可见图片解码后比对基线。
// 基线目录 .generated/visual-baseline/baseline/（playwright.config.ts 的
// expect.toHaveScreenshot.snapshotPathExpr 指定，{arg} 即快照名）。
// 首轮基线由 T8 实现者以 --update-snapshots 生成，并逐张与 T3 的 after 对照图人工比对等效后定稿。
//
// 字节稳定性处理（T3 评审发现 768/1024 dark 的 interests 截图跨运行亚像素不稳定）：
//   1. settleSection 在图片解码后追加双 rAF 等待（全部截图受益）；
//   2. 仅对这两张已知名启用 maxDiffPixelRatio: 0.02 容差，其余保持严格像素比对。
import { expect, test, type Page } from '@playwright/test'

const VIEWPORTS = [320, 390, 768, 1024, 1440] as const
const THEMES = ['light', 'dark'] as const

/* 与 Playwright clock API 配套：固定时区让日期面板落在 2026-09-21 中午（北京時間） */
test.use({ timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })

/** T3 评审确认的两张跨运行不稳定截图：允许 2% 像素差异（亚像素动画噪声） */
const KNOWN_UNSTABLE_INTERESTS = new Set(['768-dark-interests', '1024-dark-interests'])

/** 主题写入 localStorage 后重载生效（与 navigation.spec 同一契约） */
async function gotoWithTheme(page: Page, width: number, theme: 'light' | 'dark') {
  await page.clock.setFixedTime(new Date('2026-09-21T04:00:00Z'))
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/')
  await page.evaluate((value) => window.localStorage.setItem('personal-home:theme', value), theme)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await page.evaluate(() => document.fonts.ready)
}

/**
 * 滚动到目标章节并等待其中全部图片解码完成：
 * loading=lazy 的图片进入视口才开始加载，直接截图会把占位误拍成缺图。
 * decode 失败（资源缺失）由页面自身的失败占位呈现，不阻断截图。
 * 追加双 rAF：等浏览器完成布局与合成提交，消除跨运行的亚像素抖动。
 */
async function settleSection(page: Page, sectionId: string) {
  const section = page.locator(`#${sectionId}`)
  await section.scrollIntoViewIfNeeded()
  await page.evaluate(async (id) => {
    const root = document.getElementById(id)
    if (!root) return
    await Promise.all(
      Array.from(root.querySelectorAll('img')).map(async (img) => {
        try {
          await img.decode()
        } catch {
          /* 加载失败的图片走占位 UI，截图仍可反映真实状态 */
        }
      }),
    )
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  }, sectionId)
}

for (const width of VIEWPORTS) {
  for (const theme of THEMES) {
    test(`${width}px ${theme}：首屏与两个画廊章节截图`, async ({ page }) => {
      await gotoWithTheme(page, width, theme)

      // 首屏：回到顶部拍视口截图（hero 图片非懒加载，字体已就绪）
      await page.evaluate(() => window.scrollTo(0, 0))
      await settleSection(page, 'home')
      await expect(page).toHaveScreenshot(`${width}-${theme}-hero.png`)

      // 画廊章节：整节元素截图（标题、选择器与主内容同框）
      await settleSection(page, 'interests')
      const interestsOptions = KNOWN_UNSTABLE_INTERESTS.has(`${width}-${theme}-interests`)
        ? { maxDiffPixelRatio: 0.02 }
        : {}
      await expect(page.locator('#interests')).toHaveScreenshot(
        `${width}-${theme}-interests.png`,
        interestsOptions,
      )

      await settleSection(page, 'projects')
      await expect(page.locator('#projects')).toHaveScreenshot(`${width}-${theme}-projects.png`)

      // T4 项目详情：折叠态断言（原生 details 语义：关闭内容退出渲染与 Tab 顺序）
      // → 键盘 Enter 原生展开 → 拍展开态截图（真实浏览器验证 summary 键盘激活）
      const details = page.locator('#projects details.project-details').first()
      const facts = details.locator('.project-facts')
      await expect(facts).toBeHidden()
      await details.locator('summary').focus()
      await page.keyboard.press('Enter')
      await expect(details).toHaveAttribute('open')
      await expect(page.locator('#projects')).toHaveScreenshot(
        `${width}-${theme}-projects-details.png`,
      )
    })
  }
}
