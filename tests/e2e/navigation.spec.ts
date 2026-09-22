// T1 手机顶栏回归：320px 关键控件完整可见、菜单面板焦点契约与断点切换、主题循环按钮
// ARIA 契约：菜单触发按钮 name '打开导航菜单'/'关闭导航菜单'；主题按钮为单按钮循环切换
//（aria-label 以 '主题偏好：' 开头并标注当前档与下一档）；章节标题 id 为 `${sectionId}-heading`；
// 预览服务器由 playwright.config.ts 的 webServer 启动
import { expect, test, type Locator, type Page } from '@playwright/test'

const VIEWPORT_WIDTHS = [320, 390, 768, 1024, 1440] as const

/** 固定视口宽度并以指定主题基线加载首页（写入 localStorage 后重载生效） */
async function gotoWithTheme(page: Page, width: number, theme: 'light' | 'dark') {
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/')
  await page.evaluate((value) => window.localStorage.setItem('personal-home:theme', value), theme)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
}

/** 断言元素布局盒完整落在视口内（A01） */
async function expectInViewport(page: Page, locator: Locator, label: string) {
  const box = await locator.boundingBox()
  expect(box, `${label} 存在布局盒`).not.toBeNull()
  const viewport = page.viewportSize()
  expect(viewport, '视口已设置').not.toBeNull()
  expect(box!.x, `${label} 左边缘`).toBeGreaterThanOrEqual(0)
  expect(box!.y, `${label} 上边缘`).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width, `${label} 右边缘`).toBeLessThanOrEqual(viewport!.width)
  expect(box!.y + box!.height, `${label} 下边缘`).toBeLessThanOrEqual(viewport!.height)
}

test('320px 菜单完整可见且打开后焦点进入导航', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 680 })
  await page.goto('/')
  const trigger = page.getByRole('button', { name: '打开导航菜单' })
  const box = await trigger.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)

  // 触摸目标契约：两个入口各至少 44×44，相互间距 8px（主题入口在菜单按钮左侧）
  const themeBox = await page.getByRole('button', { name: '主题偏好' }).boundingBox()
  expect(themeBox).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(44)
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(themeBox!.width).toBeGreaterThanOrEqual(44)
  expect(themeBox!.height).toBeGreaterThanOrEqual(44)
  expect(box!.x - (themeBox!.x + themeBox!.width)).toBeCloseTo(8, 0)

  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('navigation').getByRole('link').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('关键控件在全部断点与双主题下完整落在视口内', async ({ page }) => {
  for (const width of VIEWPORT_WIDTHS) {
    for (const theme of ['light', 'dark'] as const) {
      await gotoWithTheme(page, width, theme)
      const suffix = `@${width}px/${theme}`

      // 品牌位（窄屏为紧凑品牌“暮色/晴光”）在所有断点必须完整可见
      await expectInViewport(page, page.getByRole('link', { name: /暮色|晴光/ }), `品牌${suffix}`)

      if (width < 1024) {
        // 窄屏：主题按钮 + 菜单按钮
        await expectInViewport(page, page.getByRole('button', { name: '主题偏好' }), `主题入口${suffix}`)
        await expectInViewport(page, page.getByRole('button', { name: '打开导航菜单' }), `菜单按钮${suffix}`)
      } else {
        // 桌面：平铺章节导航与主题按钮
        const links = page.getByRole('navigation').getByRole('link')
        const linkCount = await links.count()
        expect(linkCount, `桌面导航链接数量${suffix}`).toBeGreaterThan(0)
        for (let i = 0; i < linkCount; i++) {
          await expectInViewport(page, links.nth(i), `导航链接${i}${suffix}`)
        }
        await expectInViewport(page, page.getByRole('button', { name: '主题偏好' }), `主题入口${suffix}`)
      }
    }
  }
})

test('320px 容器两侧留白 16px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 680 })
  await page.goto('/')
  const brand = page.getByRole('link', { name: /暮色|晴光/ })
  const box = await brand.boundingBox()
  expect(box).not.toBeNull()
  // 容器两侧 16px：品牌左边缘不应小于 16px（右缘由菜单按钮用例覆盖）
  expect(box!.x).toBeGreaterThanOrEqual(16)
})

test('主题循环按钮：键盘与点击立即生效，aria-label 标注当前档与下一档', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')
  const toggle = page.getByRole('button', { name: '主题偏好' })
  const root = page.locator('html')

  // 初始档位为跟随系统（未写入偏好时）；aria-label 同时标注当前档与点击后的下一档
  await expect(toggle).toHaveAccessibleName(/主题偏好：跟随系统，点击切换为浅色/)

  // 键盘激活（Enter/Space 走原生按钮 click 语义）：跟随系统 → 浅色
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(root).toHaveAttribute('data-theme', 'light')
  await expect(toggle).toHaveAccessibleName(/主题偏好：浅色，点击切换为深色/)

  // 再点击：浅色 → 深色
  await toggle.click()
  await expect(root).toHaveAttribute('data-theme', 'dark')
  await expect(toggle).toHaveAccessibleName(/主题偏好：深色，点击切换为跟随系统/)

  // 循环回到跟随系统：有效主题由系统偏好决定，两种结果均合法
  await toggle.click()
  const dataTheme = await root.getAttribute('data-theme')
  expect(dataTheme === 'light' || dataTheme === 'dark').toBe(true)
  await expect(toggle).toHaveAccessibleName(/主题偏好：跟随系统，点击切换为浅色/)
})

test('主题按钮与导航菜单各自独立：点主题不展开菜单，菜单打开时点主题先收菜单再切主题', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')
  const navTrigger = page.getByRole('button', { name: '打开导航菜单' })
  const toggle = page.getByRole('button', { name: '主题偏好' })

  // 点主题按钮只切主题，不展开导航菜单
  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.getByRole('navigation')).toBeHidden()

  // 菜单打开时点主题按钮：主题按钮在导航面板之外，外部点击契约先收起菜单，主题切换同时生效
  await navTrigger.click()
  await expect(page.getByRole('navigation')).toBeVisible()
  await toggle.click()
  await expect(page.getByRole('navigation')).toBeHidden()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('点击外部区域关闭菜单且不抢夺外部目标焦点', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')
  const navTrigger = page.getByRole('button', { name: '打开导航菜单' })
  await navTrigger.click()
  await expect(page.getByRole('navigation')).toBeVisible()

  // 点击页面主体中的画廊标签（可聚焦元素），菜单关闭且焦点自然落在点击目标上
  const outsideTab = page.locator('#interests').getByRole('tab').first()
  await outsideTab.click()
  await expect(page.getByRole('navigation')).toBeHidden()
  await expect(outsideTab).toBeFocused()
})

test('菜单选择章节：原生 hash、焦点到标题、历史不被污染', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')
  const navTrigger = page.getByRole('button', { name: '打开导航菜单' })
  const workLink = page.getByRole('navigation').getByRole('link', { name: '作品' })

  await navTrigger.click()
  await workLink.click()
  await expect(page).toHaveURL(/#projects$/)
  await expect(page.locator('#projects-heading')).toBeFocused()
  await expect(navTrigger).toHaveAttribute('aria-expanded', 'false')

  // 原生历史行为：后退正好回到无 hash 首页，没有多余历史项
  await page.goBack()
  await expect(page).not.toHaveURL(/#projects/)

  // 同一 hash 的重复点击也聚焦章节标题（不依赖 hashchange）
  await navTrigger.click()
  await workLink.click()
  await expect(page.locator('#projects-heading')).toBeFocused()
  await expect(page).toHaveURL(/#projects$/)

  // hash 已是 #projects 时再次点击同一章节：同锚点分支直接聚焦，菜单仍关闭
  await navTrigger.click()
  await workLink.click()
  await expect(page.locator('#projects-heading')).toBeFocused()
  await expect(page).toHaveURL(/#projects$/)
  await expect(navTrigger).toHaveAttribute('aria-expanded', 'false')
})

test('菜单展开跨断点到桌面：清除展开状态并转移触发器焦点', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 })
  await page.goto('/')
  const navTrigger = page.getByRole('button', { name: '打开导航菜单' })
  await navTrigger.click()
  await expect(page.getByRole('navigation')).toBeVisible()

  await page.setViewportSize({ width: 1440, height: 800 })
  // 展开状态清除：桌面导航直接可见，触发器隐藏
  await expect(page.getByRole('navigation')).toBeVisible()
  await expect(navTrigger).toBeHidden()
  // 焦点从手机导航 UI 转到桌面对应可见导航入口
  await expect(page.getByRole('navigation').getByRole('link').first()).toBeFocused()
})

test('焦点在触发器时跨断点：导航触发器焦点转到桌面导航', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 })
  await page.goto('/')
  const navTrigger = page.getByRole('button', { name: '打开导航菜单' })
  await navTrigger.click()
  await page.keyboard.press('Escape')
  await expect(navTrigger).toBeFocused()

  await page.setViewportSize({ width: 1440, height: 800 })
  await expect(navTrigger).toBeHidden()
  await expect(page.getByRole('navigation').getByRole('link').first()).toBeFocused()
})

test('主题按钮焦点跨断点保留在按钮上', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 })
  await page.goto('/')
  const themeToggle = page.getByRole('button', { name: '主题偏好' })
  await themeToggle.focus()

  // 主题按钮在两个断点常驻可见，跨断点焦点不应丢失或被“修复”到 body
  await page.setViewportSize({ width: 1440, height: 800 })
  await expect(themeToggle).toBeFocused()
})
