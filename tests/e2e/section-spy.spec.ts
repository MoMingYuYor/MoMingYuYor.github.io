// T5 当前章节定位：Header 导航随滚动指示当前章节（aria-current="location"）。
// 核心契约：滚动观察只改变展示状态——不修改 location.hash、不调用 pushState
//（history.length 不变）、不移动焦点（A06）。
// 遮挡线取 88px = --header-height(64px) + scroll-margin-top 余量(24px)，与
// global.css 的 section[id] scroll-margin-top 一致，锚点直跳后章节顶部恰在线上。
// 预览服务器由 playwright.config.ts 的 webServer 显式启动。
import { expect, test, type Page } from '@playwright/test'

const HEADER_LINE = 88

/** 将章节滚动到 Header 遮挡线之上（rect.top <= HEADER_LINE），等价自然滚动越过标题线 */
async function scrollSectionPastHeaderLine(page: Page, sectionId: string) {
  await page.locator(`#${sectionId}`).scrollIntoViewIfNeeded()
  await page.evaluate(
    ({ id, line }) => {
      const el = document.getElementById(id)
      if (!el) return
      const overshoot = el.getBoundingClientRect().top - line
      if (overshoot > 0) window.scrollBy(0, overshoot + 8)
    },
    { id: sectionId, line: HEADER_LINE },
  )
}

test('滚动到作品区后仅作品导航带 aria-current，且不改变 hash、历史与焦点', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation')
  const hashBefore = await page.evaluate(() => window.location.hash)
  const historyBefore = await page.evaluate(() => window.history.length)
  // 焦点固定在章节标题上，滚动后必须原样保留（观察器不移动焦点）
  await page.locator('#home-heading').focus()
  await expect(page.locator('#home-heading')).toBeFocused()

  await scrollSectionPastHeaderLine(page, 'projects')
  const current = nav.locator('a[aria-current="location"]')
  await expect(current).toHaveCount(1)
  await expect(current).toHaveAccessibleName('作品')
  await expect(page.locator('#home-heading')).toBeFocused()

  // 纯滚动不写入历史、不修改 hash
  expect(await page.evaluate(() => window.location.hash)).toBe(hashBefore)
  expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)
})

test('大章节覆盖屏幕时保持选中：小幅下滚不切换到下一章节', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation')
  const interestsLink = nav.getByRole('link', { name: '兴趣' })

  await scrollSectionPastHeaderLine(page, 'interests')
  // 前置校验：此刻作品区顶部仍在遮挡线之下
  const projectsTop = await page.evaluate(
    () => document.getElementById('projects')!.getBoundingClientRect().top,
  )
  expect(projectsTop, '前置校验：作品区顶部尚未越过遮挡线').toBeGreaterThan(HEADER_LINE)

  await expect(interestsLink).toHaveAttribute('aria-current', 'location')
  // 兴趣章节高度远超一屏：再下滚 240px 后作品区仍未越过遮挡线，应保持兴趣选中
  await page.mouse.wheel(0, 240)
  await expect(interestsLink).toHaveAttribute('aria-current', 'location')
})

test('页面滚到底部选中最后可见章节，历史仍不被污染', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation')
  const hashBefore = await page.evaluate(() => window.location.hash)
  const historyBefore = await page.evaluate(() => window.history.length)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const current = nav.locator('a[aria-current="location"]')
  await expect(current).toHaveCount(1)
  await expect(current).toHaveAccessibleName('关于')

  expect(await page.evaluate(() => window.location.hash)).toBe(hashBefore)
  expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)
})

test('直接 hash 打开页面立即指示对应章节', async ({ page }) => {
  await page.goto('/#projects')
  const current = page.getByRole('navigation').locator('a[aria-current="location"]')
  await expect(current).toHaveCount(1)
  await expect(current).toHaveAccessibleName('作品')
})

test('浏览器后退与前进后观察状态同步', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation')
  const homeLink = nav.getByRole('link', { name: '首页' })
  const interestsLink = nav.getByRole('link', { name: '兴趣' })

  await nav.getByRole('link', { name: '兴趣' }).click()
  await expect(page).toHaveURL(/#interests$/)
  await expect(interestsLink).toHaveAttribute('aria-current', 'location')

  // 后退回无 hash 首页：回到顶部，指示首页
  await page.goBack()
  await expect(page).not.toHaveURL(/#interests/)
  await expect(homeLink).toHaveAttribute('aria-current', 'location')
  await expect(interestsLink).not.toHaveAttribute('aria-current', 'location')

  // 前进回 #interests：恢复锚点滚动位置，指示兴趣
  await page.goForward()
  await expect(page).toHaveURL(/#interests$/)
  await expect(interestsLink).toHaveAttribute('aria-current', 'location')
})
