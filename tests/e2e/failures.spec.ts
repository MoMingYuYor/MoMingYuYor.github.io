// T8 移动/异常场景回归（技术方案 6.4）：窄屏画廊交互、图片请求失败降级、无脚本最小说明。
// 覆盖 A03 失败占位、A04 手机短屏、A08 图片失败正文可读、A12 无脚本承诺的浏览器级证据；
// 预览服务器由 playwright.config.ts 的 webServer 启动（CI/verify 下强制本次构建新起服务）。
import { expect, test } from '@playwright/test'

test.describe('窄屏 320px（A04）', () => {
  test.use({ viewport: { width: 320, height: 680 } })

  test('横向标签点击切换画廊条目，页面无横向溢出', async ({ page }) => {
    await page.goto('/')
    const interests = page.locator('#interests')
    const tablist = interests.getByRole('tablist')
    await tablist.getByRole('tab').nth(1).click()
    await expect(tablist.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true')

    // 切换后仍只有一个可见面板，且内容为对应条目
    const visiblePanel = interests.getByRole('tabpanel').filter({ visible: true })
    await expect(visiblePanel).toHaveCount(1)
    await expect(visiblePanel.getByRole('heading', { name: '硬件发烧友 · 超频' })).toBeVisible()

    // 无横向溢出：scrollWidth 不超过视口 clientWidth
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, '320px 不允许出现横向溢出').toBeLessThanOrEqual(0)
  })
})

test.describe('图片请求失败（A03/A08）', () => {
  test('画廊主图失败：占位与替代文本出现，切走再切回仍保留失败记录', async ({ page }) => {
    await page.route(/placeholder-photo-1\.svg$/, (route) => route.abort())
    await page.goto('/')
    const interests = page.locator('#interests')
    const panel = interests.getByRole('tabpanel').filter({ visible: true })

    // 主图失败：固定占位显示替代文本，激活面板内不再有 img
    await expect(panel.locator('.media-fallback')).toBeVisible()
    await expect(panel.locator('.media-fallback')).toHaveText('装机照片待补充：电脑 DIY 装机过程')
    await expect(panel.locator('img')).toHaveCount(0)
    // 同 URL 缩略图共享失败状态
    await expect(interests.locator('.gallery-tab-thumb-fallback')).toHaveCount(1)

    // 切到第二项：不继承失败标记
    await interests.getByRole('tab').nth(1).click()
    await expect(panel.locator('.media-fallback')).toBeHidden()
    await expect(panel.locator('img').first()).toBeVisible()

    // 切回第一项：失败记录保留
    await interests.getByRole('tab').nth(0).click()
    await expect(panel.locator('.media-fallback')).toBeVisible()
  })

  test('hero 壁纸失败：标题、问候等正文仍完整可读', async ({ page }) => {
    await page.route(/hero-(light|dark)\.webp$/, (route) => route.abort())
    await page.goto('/')
    // 页面正文不依赖壁纸：h1 身份名与首屏短句照常呈现
    await expect(page.getByRole('heading', { level: 1, name: 'MoMingYu' })).toBeVisible()
    await expect(page.getByText('把喜欢的事，慢慢做成生活。')).toBeVisible()
    // hero 区域存在但壁纸位置以背景/占位呈现，不产生布局塌陷
    await expect(page.locator('#home')).toBeVisible()
  })
})

test.describe('无脚本（A12）', () => {
  test.use({ javaScriptEnabled: false })

  test('禁用 JS 时展示最小说明与已核验联系入口', async ({ page }) => {
    await page.goto('/')
    // noscript 静态说明（JS 禁用时浏览器才解析 noscript 内容为元素）。
    // 段落内混排文本与链接，getByText 无法跨越子元素边界匹配，改用 toContainText。
    await expect(page.getByRole('heading', { name: 'MoMingYu' })).toBeVisible()
    const note = page.locator('noscript p')
    await expect(note).toBeVisible()
    await expect(note).toContainText('完整主页需要启用 JavaScript 才能浏览。')
    // 无脚本联系入口只使用已核验的 https/mailto 地址（renderNoscriptContact 规则）
    const contact = page.locator('noscript a')
    await expect(contact).toBeVisible()
    await expect(contact).toHaveAttribute('href', /^https:\/\//)
    await expect(contact).toHaveAccessibleName('GitHub')
  })
})
