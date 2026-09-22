// 首页端到端验收：预览服务器由 playwright.config.ts 的 webServer 显式启动
// 所有断言基于 ARIA 契约：tablist/tab/tabpanel，主题为单按钮循环切换
//（aria-label 以 '主题偏好：' 开头，标注当前档与点击后的下一档）
import { expect, test, type Page } from '@playwright/test'

/** 主题单按钮循环切换：从当前档点击到目标档（循环一周最多 3 次） */
async function setThemePreference(page: Page, target: '跟随系统' | '浅色' | '深色') {
  const toggle = page.getByRole('button', { name: '主题偏好' })
  for (let i = 0; i < 3; i++) {
    const label = (await toggle.getAttribute('aria-label')) ?? ''
    if (label.startsWith(`主题偏好：${target}，`)) return
    await toggle.click()
  }
  throw new Error(`主题循环切换未到达目标档：${target}`)
}

test('首页加载并展示全部章节', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#home')).toBeVisible()
  await expect(page.locator('#interests')).toBeVisible()
  await expect(page.locator('#projects')).toBeVisible()
  await expect(page.locator('#about')).toBeVisible()
  await expect(page).toHaveTitle(/MoMingYu/)
})

test('主题切换与持久化', async ({ page }) => {
  await page.goto('/')
  const root = page.locator('html')

  // 循环切到深色后根元素立即切换主题属性
  await setThemePreference(page, '深色')
  await expect(root).toHaveAttribute('data-theme', 'dark')

  // 刷新后偏好从 localStorage 恢复，仍为深色
  await page.reload()
  await expect(root).toHaveAttribute('data-theme', 'dark')

  // 跟随系统时有效主题由系统偏好决定（headless Chromium 默认浅色），两种结果均合法
  await setThemePreference(page, '跟随系统')
  const dataTheme = await root.getAttribute('data-theme')
  expect(dataTheme === 'light' || dataTheme === 'dark').toBe(true)
})

test('画廊竖向标签键盘导航', async ({ page }) => {
  // 默认视口 1280x720 为桌面布局：侧栏竖向标签，ArrowDown/ArrowUp 移动
  await page.goto('/')
  // 页面包含兴趣与项目两个画廊，键盘断言限定在兴趣画廊的 tablist 内，
  // 避免另一画廊的选中标签干扰 getByRole('tab', { selected: true }) 的匹配
  const tablist = page.locator('#interests').getByRole('tablist')
  const tabs = tablist.getByRole('tab')

  await tabs.first().focus()
  await page.keyboard.press('ArrowDown')
  // 该画廊任一时刻只有一个选中标签，ArrowDown 后选中的是第二个
  await expect(tablist.getByRole('tab', { selected: true })).toHaveCount(1)
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')

  // End 跳到末项
  await page.keyboard.press('End')
  await expect(tablist.getByRole('tab', { selected: true })).toHaveCount(1)
  await expect(tabs.last()).toHaveAttribute('aria-selected', 'true')

  // Home 跳回首项
  await page.keyboard.press('Home')
  await expect(tablist.getByRole('tab', { selected: true })).toHaveCount(1)
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')

  // 任一时刻该画廊只显示一个面板：兼容“仅渲染激活面板”与“渲染全部、CSS 隐藏”两种实现
  const panels = page.locator('#interests').getByRole('tabpanel')
  await expect(panels.filter({ visible: true })).toHaveCount(1)
})

test('锚点导航到作品区', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: '作品' }).click()
  await expect(page).toHaveURL(/#projects/)
  await expect(page.locator('#projects')).toBeInViewport()
})

test('双主题整页截图', async ({ page }) => {
  // 显式循环到浅色作为基准，避免运行环境的系统深色偏好影响 light 截图
  await page.goto('/', { waitUntil: 'networkidle' })
  await setThemePreference(page, '浅色')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.screenshot({ path: '.generated/screenshots/e2e-light.png', fullPage: true })

  await setThemePreference(page, '深色')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({ path: '.generated/screenshots/e2e-dark.png', fullPage: true })
})
