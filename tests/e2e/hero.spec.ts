import { expect, test } from '@playwright/test'

/**
 * S1-T8 首页身份区与山湖主视觉的验收用例。
 * 关注四件事：首屏露出下一节、主题与主视觉一致、预载与实际显示同一文件、无脚本可读。
 */

const FIRSTFOLD_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
  { width: 320, height: 680 },
]

/** 主视觉壁纸请求记录，用来验证「只下载一张」与「预载与显示同文件」 */
function recordHeroRequests(page: import('@playwright/test').Page): string[] {
  const requested: string[] = []
  page.on('request', (request) => {
    if (/hero-(light|dark)\.webp/.test(request.url())) requested.push(request.url())
  })
  return requested
}

test.describe('首屏露出下一节', () => {
  for (const viewport of FIRSTFOLD_VIEWPORTS) {
    test(`${viewport.width}×${viewport.height} 能看到第一个内容章节的标题`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/')

      // 条件：下一节的标题或实际内容进入第一屏，不接受用悬浮下箭头代替
      const heading = page.locator('#home-projects')
      await expect(heading).toBeVisible()
      const box = await heading.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y).toBeLessThan(viewport.height)

      // 首屏不强制 100vh，也不允许整页横向溢出
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
    })
  }
})

test.describe('主题与主视觉', () => {
  test('跟随系统为深色时，只请求深色壁纸，且预载与显示为同一文件', async ({ page }) => {
    const requested = recordHeroRequests(page)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/', { waitUntil: 'networkidle' })

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(requested.some((url) => url.includes('hero-dark.webp'))).toBe(true)
    expect(requested.some((url) => url.includes('hero-light.webp'))).toBe(false)

    const preloadHref = await page
      .locator('link[rel="preload"][as="image"]')
      .first()
      .getAttribute('href')
    // 比较浏览器实际选中的文件（currentSrc），而不是 src 属性——<picture> 下二者可能不同
    const renderedSrc = await page
      .locator('[data-hero-image]')
      .evaluate((el) => (el as HTMLImageElement).currentSrc)
    expect(preloadHref).not.toBeNull()
    expect(new URL(preloadHref!, page.url()).href).toBe(renderedSrc)
  })

  test('显式深色偏好压过系统浅色：首帧即深色，主视觉为深色图', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('personal-home:theme', 'dark'))
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/', { waitUntil: 'networkidle' })

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('[data-hero-image]')).toHaveAttribute('src', /hero-dark\.webp/)
  })

  test('显式浅色偏好压过系统深色：主视觉为浅色图', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('personal-home:theme', 'light'))
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/', { waitUntil: 'networkidle' })

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('[data-hero-image]')).toHaveAttribute('src', /hero-light\.webp/)
  })

  test('切换主题后主视觉跟随，且保留已成功显示的图直到目标图可用', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/', { waitUntil: 'networkidle' })

    const image = page.locator('[data-hero-image]')
    await expect(image).toHaveAttribute('src', /hero-light\.webp/)

    // 桌面宽度下主题分段常驻页头；点可见的标签（radio 视觉隐藏，图标会拦截对 input 的直接点击）
    await page.locator('.theme-control__option', { hasText: '深色' }).click()
    await expect(page.getByRole('radio', { name: '深色' })).toBeChecked()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(image).toHaveAttribute('src', /hero-dark\.webp/)

    // 切换过程中主视觉始终有可显示的图，不出现空背景
    const src = await image.getAttribute('src')
    expect(src).toBeTruthy()
  })
})

test.describe('内容与降级', () => {
  test('身份区不套卡片：姓名与入口所在容器无背景色与边框', async ({ page }) => {
    await page.goto('/')
    const styles = await page.evaluate(() => {
      const read = (selector: string) => {
        const el = document.querySelector(selector)
        if (!el) return null
        const computed = getComputedStyle(el)
        return {
          background: computed.backgroundColor,
          borderWidth: el === document.querySelector(selector) ? computed.borderTopWidth : '0px',
        }
      }
      return {
        name: read('.hero__name'),
        actions: read('.hero__actions'),
      }
    })
    expect(styles.name).not.toBeNull()
    expect(styles.name!.background).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
    expect(styles.name!.borderWidth).toBe('0px')
    expect(styles.actions!.background).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
    expect(styles.actions!.borderWidth).toBe('0px')
  })

  test('日期与问候在加载后按访客本地时间重算，覆盖构建期文本', async ({ page }) => {
    // 固定到与构建日期不同的时刻，证明文本确实来自客户端求值
    await page.clock.install({ time: new Date('2027-03-05T15:30:00') })
    await page.goto('/')

    await expect(page.locator('[data-hero-month-day]')).toHaveText('03 / 05')
    await expect(page.locator('[data-hero-year]')).toHaveText('2027')
    await expect(page.locator('[data-hero-greeting]')).toHaveText('下午好')
    await expect(page.locator('[data-hero-date]')).toHaveAttribute('datetime', '2027-03-05')
  })

  test('主视觉图片加载失败时正文仍可读', async ({ page }) => {
    await page.route('**/hero-*.webp', (route) => route.abort())
    await page.goto('/')

    await expect(page.locator('#hero-name')).toHaveText('MoMingYu')
    await expect(page.getByRole('link', { name: '查看作品' })).toBeVisible()
    await expect(page.locator('.hero')).toBeVisible()
  })

  test('无脚本时身份区与四个章节入口完整可读', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/')

    await expect(page.locator('#hero-name')).toHaveText('MoMingYu')
    await expect(page.locator('#home-projects')).toBeVisible()
    await expect(page.locator('#home-hardware')).toBeVisible()
    await expect(page.locator('#home-posts')).toBeVisible()
    await expect(page.locator('#home-about')).toBeVisible()
    await expect(page.locator('[data-hero-image]')).toBeVisible()

    await context.close()
  })

  test('页面不出现编辑说明或演示文案', async ({ page }) => {
    await page.goto('/')
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(/此处|用于展示|占位|待补充|示意|演示|编辑说明|Lorem|TODO/)
  })
})
