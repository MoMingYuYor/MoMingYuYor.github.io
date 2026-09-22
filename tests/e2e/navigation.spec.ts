import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * 站点页头、主题控件与手机导航的浏览器回归（计划 S1-T6）。
 *
 * 依据：规格第 2 节（主导航固定为“首页、作品、硬件、博客、关于”，顺序固定；品牌使用
 * MoMingYu 且不随主题改变）、第 3 与 11.4 节（主题状态只出现在主题控件里，不放进品牌位；
 * 模式选择用分段选项，明确呈现当前偏好，不要求用户猜测循环顺序；图标统一 Lucide 规格；
 * 主要触摸目标 44px；键盘焦点始终可见；颜色不是选中状态的唯一标记）、第 9 节（手机导航
 * 使用无脚本也可展开的原生结构，脚本只增强外部点击关闭、Escape 与焦点管理；桌面导航始终
 * 直接可见）、第 10 节（导航收起行为覆盖触发器后代元素、点外部、Escape 和断点变化）、
 * 第 13 节（除局部滚动容器外不允许整页横向溢出）。
 *
 * 验收对应：A06（手机菜单点击图标中心和按钮边缘均可关闭，Escape 与焦点处理正确）、
 * A07（主题跨页持久化、存储不可用可降级）。
 *
 * 期望地址在此显式声明：`src/lib/site.ts` 在模块顶层读取 `import.meta.env`，不能在
 * Playwright 进程里导入，因此导航值与主题存储键在这里以期望值形式复述（与 footer.spec.ts
 * 同一做法）。
 *
 * 未覆盖（如实标注）：
 * - 导航指向的 `/projects/`、`/hardware/`、`/blog/` 三个索引页由 S1-T9 建立，当前不存在。
 *   因此只断言链接的 href 与交互行为，不点击后断言目标页内容，也不断言这些路径返回 200。
 * - 真机触控（这里用 Chrome 的触摸事件模拟）、读屏实际播报、200% 文字缩放、短屏（320×680
 *   之外）、跨浏览器（本阶段只跑系统 Chrome，第四阶段 S4-T6 扩展）。
 * - 视觉基线（第四阶段 S4-T4 定为 tests/visual-baseline/）。
 */

/** 主导航固定五项，顺序固定（规格第 2 节） */
const NAV_ITEMS: ReadonlyArray<{ label: string; href: string }> = [
  { label: '首页', href: '/' },
  { label: '作品', href: '/projects/' },
  { label: '硬件', href: '/hardware/' },
  { label: '博客', href: '/blog/' },
  { label: '关于', href: '/about/' },
]

/** 主题存储键与 `src/lib/theme.ts` 的 THEME_STORAGE_KEY 一致 */
const THEME_STORAGE_KEY = 'personal-home:theme'

/** 导航开关的稳定钩子：`summary` 是原生触发器，`details[open]` 是展开状态的唯一事实来源 */
const MENU_OPEN = '[data-nav-menu][open]'
const TRIGGER = 'summary[data-nav-menu-trigger]'
const PANEL = '[data-nav-menu-panel]'

/** 布局验收宽度（规格第 13 节）：768px 及以下用手机菜单，1024px 起桌面导航常驻 */
const MOBILE_WIDTHS = [320, 390, 768] as const
const DESKTOP_WIDTH = 1024

/** 旧实现把主题状态文字放进品牌位（晴光/暮色、LIGHT/DARK），规格第 3、11.4 节禁止 */
const THEME_STATUS_WORDS_IN_BRAND = /晴光|暮色|LIGHT|DARK/i

function trigger(page: Page): Locator {
  return page.locator(TRIGGER)
}

function navLinks(page: Page): Locator {
  return page.locator(`${PANEL} nav a`)
}

function themeGroup(page: Page): Locator {
  return page.getByRole('group', { name: '主题偏好' })
}

/** 主题分段：可见的整段（label），点击与真实用户操作一致 */
function themeOption(page: Page, label: string): Locator {
  return themeGroup(page).locator('label').filter({ hasText: label })
}

function themeRadio(page: Page, label: string): Locator {
  return themeGroup(page).getByRole('radio', { name: label })
}

/** 菜单是否展开只看 `details[open]`，不依赖脚本维护的状态 */
async function expectMenuOpen(page: Page, label: string): Promise<void> {
  await expect(page.locator(MENU_OPEN), `${label}：details[open] 应存在`).toHaveCount(1)
}

async function expectMenuClosed(page: Page, label: string): Promise<void> {
  await expect(page.locator(MENU_OPEN), `${label}：details[open] 不应存在`).toHaveCount(0)
}

/** 五项导航的标签与地址：顺序与 href 都要逐项核对 */
async function expectNavItems(page: Page, label: string): Promise<void> {
  const links = navLinks(page)
  await expect(links, `${label}：导航项数量`).toHaveCount(NAV_ITEMS.length)
  for (const [index, item] of NAV_ITEMS.entries()) {
    await expect(links.nth(index), `${label}：第 ${index + 1} 项标签`).toHaveText(item.label)
    await expect(links.nth(index), `${label}：第 ${index + 1} 项地址`).toHaveAttribute('href', item.href)
  }
}

/** 整页不得横向溢出（规格第 13 节） */
async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const width = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(width.scrollWidth, `${label}：整页横向溢出`).toBeLessThanOrEqual(width.innerWidth)
}

async function storedPreference(page: Page): Promise<string | null> {
  return page.evaluate((key: string) => window.localStorage.getItem(key), THEME_STORAGE_KEY)
}

/**
 * 键盘焦点必须可见（规格第 11.4 节）。主题分段的原生 radio 是视觉隐藏的，
 * 焦点轮廓画在它所属的 label 上，所以先取最近的 label。
 */
async function expectVisibleFocusRing(page: Page, label: string): Promise<void> {
  const outline = await page.evaluate(() => {
    const active = document.activeElement
    if (!(active instanceof HTMLElement)) return null
    const target = active.closest('label') ?? active
    const style = getComputedStyle(target)
    return { line: style.outlineStyle, width: style.outlineWidth }
  })
  expect(outline, `${label}：应有焦点元素`).not.toBeNull()
  expect(outline!.line, `${label}：焦点轮廓线型`).toBe('solid')
  expect(Number.parseFloat(outline!.width), `${label}：焦点轮廓宽度`).toBeGreaterThan(0)
}

/** 主要触摸目标以 44px 为设计目标（规格第 11.4 节） */
async function expectTouchTarget(target: Locator, label: string): Promise<void> {
  const box = await target.boundingBox()
  expect(box, `${label}：布局盒`).not.toBeNull()
  expect(box!.height, `${label}：高度`).toBeGreaterThanOrEqual(44)
  expect(box!.width, `${label}：宽度`).toBeGreaterThanOrEqual(44)
}

/** 记录下一次 pointerdown 的落点标签，用来证明点击真的落在触发器后代（图标）上 */
async function recordNextPointerTarget(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window as unknown as { __pointerTargets: string[] }
    store.__pointerTargets = []
    document.addEventListener(
      'pointerdown',
      (event) => {
        const target = event.target
        if (target instanceof Element) store.__pointerTargets.push(target.tagName.toLowerCase())
      },
      { capture: true, once: true },
    )
  })
}

async function readPointerTarget(page: Page): Promise<string | undefined> {
  return page.evaluate(
    () => (window as unknown as { __pointerTargets?: string[] }).__pointerTargets?.[0],
  )
}

test('手机导航在 320/390/768 下可展开，五项链接与地址正确', async ({ page }) => {
  for (const width of MOBILE_WIDTHS) {
    const label = `${width}px`
    await page.setViewportSize({ width, height: width < 768 ? 680 : 900 })
    await page.goto('/')

    const menuTrigger = trigger(page)
    await expect(menuTrigger, `${label}：触发器可见`).toBeVisible()
    await expect(menuTrigger, `${label}：触发器名称`).toHaveAccessibleName('打开导航菜单')
    // 44px 触摸目标（规格第 11.4 节）
    await expectTouchTarget(menuTrigger, `${label}：触发器`)

    // 未展开时导航既不在无障碍树里，也不在 Tab 顺序中（原生 details 的收起语义）
    await expect(page.getByRole('navigation', { name: '站点导航' }), `${label}：收起时导航`).toHaveCount(0)
    await expectMenuClosed(page, `${label}：初始`)

    await menuTrigger.click()
    await expectMenuOpen(page, `${label}：点击触发器后`)
    await expect(page.getByRole('navigation', { name: '站点导航' }), `${label}：展开时导航`).toBeVisible()
    await expectNavItems(page, `${label}：展开后`)
    await expectNoHorizontalOverflow(page, `${label}：展开时`)

    await menuTrigger.click()
    await expectMenuClosed(page, `${label}：再次点击触发器后`)
  }
})

test('桌面导航始终直接可见，触发器不出现', async ({ page }) => {
  for (const width of [DESKTOP_WIDTH, 1440]) {
    const label = `${width}px`
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')

    // 桌面导航直接可见，不需要任何交互（规格第 9 节）
    await expect(page.getByRole('navigation', { name: '站点导航' }), `${label}：导航可见`).toBeVisible()
    await expectNavItems(page, label)
    await expect(trigger(page), `${label}：触发器隐藏`).toBeHidden()
    // 主题分段与导航同排常驻，不需要展开菜单
    await expect(themeGroup(page), `${label}：主题分段可见`).toBeVisible()
    await expectNoHorizontalOverflow(page, label)

    // 触摸目标 44px：导航项与三个主题分段
    for (const item of NAV_ITEMS) {
      await expectTouchTarget(navLinks(page).filter({ hasText: item.label }), `${label}：导航项「${item.label}」`)
    }
    for (const option of ['跟随系统', '浅色', '深色']) {
      await expectTouchTarget(themeOption(page, option), `${label}：主题分段「${option}」`)
    }
  }
})

test('手机菜单：点击图标中心、点击触发器边缘、触摸点击都能关闭', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')
  const menuTrigger = trigger(page)
  const box = await menuTrigger.boundingBox()
  expect(box).not.toBeNull()

  // 1) 点击触发器中心：落点是图标（触发器的后代）。旧实现只比较 target === trigger，
  //    会把这一下判成“外部点击”先关闭，再被原生展开，菜单关不掉。
  await menuTrigger.click()
  await expectMenuOpen(page, '点击图标中心前')
  await recordNextPointerTarget(page)
  await menuTrigger.click({ position: { x: box!.width / 2, y: box!.height / 2 } })
  expect(await readPointerTarget(page), '点击触发器中心的落点应是图标（svg 或 path）').toMatch(/^(svg|path)$/)
  await expectMenuClosed(page, '点击图标中心后')

  // 2) 点击触发器边缘：落点是触发器本身
  await menuTrigger.click()
  await expectMenuOpen(page, '点击触发器边缘前')
  await recordNextPointerTarget(page)
  await menuTrigger.click({ position: { x: 3, y: 3 } })
  expect(await readPointerTarget(page), '点击触发器边缘的落点应是 summary 本身').toBe('summary')
  await expectMenuClosed(page, '点击触发器边缘后')
})

test.describe('触摸输入', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 800 } })

  test('触摸点击触发器也能关闭菜单', async ({ page }) => {
    await page.goto('/')
    const menuTrigger = trigger(page)
    const box = await menuTrigger.boundingBox()
    expect(box).not.toBeNull()
    const center = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }

    await page.touchscreen.tap(center.x, center.y)
    await expectMenuOpen(page, '触摸展开后')
    await expect(page.getByRole('navigation', { name: '站点导航' })).toBeVisible()

    await page.touchscreen.tap(center.x, center.y)
    await expectMenuClosed(page, '触摸关闭后')
  })
})

test('打开后焦点进入首个导航链接，Escape 关闭并把焦点还给触发器', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')
  const menuTrigger = trigger(page)

  // 窄屏 Tab 顺序：品牌位之后就是菜单触发器（主题分段在收起的面板里，不参与 Tab）
  await page.getByRole('banner').getByRole('link', { name: 'MoMingYu' }).focus()
  await page.keyboard.press('Tab')
  await expect(menuTrigger, 'Tab 应停在菜单触发器上').toBeFocused()
  await expectVisibleFocusRing(page, '菜单触发器')
  await page.keyboard.press('Enter')
  await expectMenuOpen(page, 'Enter 展开后')
  await expect(navLinks(page).first(), '展开后焦点应在首个导航链接').toBeFocused()
  await expectVisibleFocusRing(page, '首个导航链接')

  await page.keyboard.press('Escape')
  await expectMenuClosed(page, 'Escape 后')
  await expect(menuTrigger, 'Escape 后焦点应还给触发器').toBeFocused()

  // 关闭状态下内部链接退出 Tab 顺序，焦点不会落回已隐藏的面板
  await page.keyboard.press('Tab')
  const focusInPanel = await page.evaluate(() => document.activeElement?.closest('[data-nav-menu-panel]') !== null)
  expect(focusInPanel, '收起后焦点不应进入面板').toBe(false)
})

test('展开的菜单不是模态弹窗：Tab 可以离开面板', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')
  await trigger(page).click()
  await expectMenuOpen(page, '展开后')
  await expect(navLinks(page).first()).toBeFocused()

  // 面板内可聚焦项：五项链接 + 当前选中的主题分段；继续 Tab 必须能走出面板
  for (let step = 0; step < 7; step += 1) {
    await page.keyboard.press('Tab')
  }
  const focusInPanel = await page.evaluate(() => document.activeElement?.closest('[data-nav-menu-panel]') !== null)
  expect(focusInPanel, 'Tab 应能离开面板，菜单不锁焦点').toBe(false)
  // 菜单仍保持展开：焦点离开不自动收起，避免键盘用户来回丢失位置
  await expectMenuOpen(page, 'Tab 离开后')
})

test('外部点击关闭菜单，且不把焦点留在隐藏区域', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')
  await trigger(page).click()
  await expectMenuOpen(page, '展开后')

  // 面板之外、页头之外的空白区域
  await page.mouse.click(20, 760)
  await expectMenuClosed(page, '外部点击后')
  const focusInPanel = await page.evaluate(() => document.activeElement?.closest('[data-nav-menu-panel]') !== null)
  expect(focusInPanel, '外部点击后焦点不应留在面板内').toBe(false)
})

test('跨断点：展开状态被清除，焦点转移到桌面导航', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await page.goto('/')
  await trigger(page).click()
  await expectMenuOpen(page, '窄屏展开后')
  await expect(navLinks(page).first()).toBeFocused()

  await page.setViewportSize({ width: DESKTOP_WIDTH, height: 900 })
  await expectMenuClosed(page, '跨到桌面后')
  await expect(trigger(page), '跨到桌面后触发器隐藏').toBeHidden()
  await expect(page.getByRole('navigation', { name: '站点导航' }), '跨到桌面后导航可见').toBeVisible()
  await expect(navLinks(page).first(), '跨到桌面后焦点转移到可见导航入口').toBeFocused()
})

test('品牌位固定显示 MoMingYu，不出现主题状态文字', async ({ page }) => {
  for (const width of [320, DESKTOP_WIDTH]) {
    for (const theme of ['light', 'dark'] as const) {
      const label = `${width}px/${theme}`
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await page.evaluate(
        (input: { key: string; value: string }) => window.localStorage.setItem(input.key, input.value),
        { key: THEME_STORAGE_KEY, value: theme },
      )
      await page.reload()
      await expect(page.locator('html'), `${label}：主题已生效`).toHaveAttribute('data-theme', theme)

      const brand = page.getByRole('banner').getByRole('link', { name: 'MoMingYu' })
      await expect(brand, `${label}：品牌位可见`).toBeVisible()
      await expect(brand, `${label}：品牌位文字固定`).toHaveText('MoMingYu')
      // 品牌位不承载主题状态：晴光/暮色、LIGHT/DARK 都不得出现在页头里
      await expect(page.getByRole('banner'), `${label}：页头不含主题状态文字`).not.toContainText(
        THEME_STATUS_WORDS_IN_BRAND,
      )
    }
  }
})

test('主题三档：跟随系统 / 浅色 / 深色 都能切换，刷新与跨页后保持', async ({ page }) => {
  // 固定系统外观，让“跟随系统”档的结果可判定
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: 900 })
  await page.goto('/')
  const root = page.locator('html')

  // 未写入偏好时按“跟随系统”呈现，有效主题来自系统外观
  await expect(themeRadio(page, '跟随系统'), '初始选中项').toBeChecked()
  await expect(root, '跟随系统 + 系统深色').toHaveAttribute('data-theme', 'dark')
  expect(await storedPreference(page), '初始不写入偏好').toBeNull()

  // 显式浅色：系统是深色也变浅色
  await themeOption(page, '浅色').click()
  await expect(themeRadio(page, '浅色')).toBeChecked()
  await expect(root, '显式浅色').toHaveAttribute('data-theme', 'light')
  expect(await storedPreference(page), '写入浅色偏好').toBe('light')

  // 刷新后保持，并且控件仍呈现真实偏好
  await page.reload()
  await expect(root, '刷新后保持浅色').toHaveAttribute('data-theme', 'light')
  await expect(themeRadio(page, '浅色'), '刷新后选中项').toBeChecked()

  // 跨页面保持（/about/ 使用同一个 BaseLayout 与同一份首帧引导）
  await page.goto('/about/')
  await expect(root, '跨页后保持浅色').toHaveAttribute('data-theme', 'light')
  await expect(themeRadio(page, '浅色'), '跨页后选中项').toBeChecked()

  // 显式深色
  await themeOption(page, '深色').click()
  await expect(themeRadio(page, '深色')).toBeChecked()
  await expect(root, '显式深色').toHaveAttribute('data-theme', 'dark')
  expect(await storedPreference(page), '写入深色偏好').toBe('dark')

  // 回到跟随系统：有效主题重新由系统外观决定
  await themeOption(page, '跟随系统').click()
  await expect(themeRadio(page, '跟随系统')).toBeChecked()
  await expect(root, '跟随系统 + 系统深色').toHaveAttribute('data-theme', 'dark')
  expect(await storedPreference(page), '写回 system').toBe('system')

  // 系统外观变化时“跟随系统”档实时跟随
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(root, '系统切浅色后跟随').toHaveAttribute('data-theme', 'light')
})

test('窄屏：主题分段随菜单展开，选择后主题生效并持久化', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')

  // 收起时主题控件不在无障碍树中
  await expect(themeGroup(page), '收起时的主题分段').toHaveCount(0)

  await trigger(page).click()
  await expectMenuOpen(page, '展开后')
  await expect(themeGroup(page), '展开后的主题分段').toBeVisible()
  await expectNoHorizontalOverflow(page, '窄屏展开菜单')

  await themeOption(page, '浅色').click()
  await expect(page.locator('html'), '窄屏选择浅色').toHaveAttribute('data-theme', 'light')
  // 选择主题属于面板内部操作，不收起菜单
  await expectMenuOpen(page, '选择主题后')

  await page.reload()
  await expect(page.locator('html'), '刷新后保持浅色').toHaveAttribute('data-theme', 'light')
  await trigger(page).click()
  await expect(themeRadio(page, '浅色'), '刷新后选中项').toBeChecked()
})

test('键盘可达：品牌 → 五项导航 → 主题分段，方向键切换主题', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: 900 })
  await page.goto('/')

  // Tab 顺序：品牌位之后依次是五项导航链接，然后进入主题分段
  await page.getByRole('banner').getByRole('link', { name: 'MoMingYu' }).focus()
  await page.keyboard.press('Tab')
  for (const [index, item] of NAV_ITEMS.entries()) {
    await expect(navLinks(page).nth(index), `Tab 第 ${index + 1} 站应是「${item.label}」`).toBeFocused()
    await expectVisibleFocusRing(page, `导航项「${item.label}」`)
    await page.keyboard.press('Tab')
  }
  await expect(themeRadio(page, '跟随系统'), '导航之后应进入主题分段').toBeFocused()
  await expectVisibleFocusRing(page, '主题分段')

  // 分段选项用原生 radio：方向键移动并选中，主题立即生效
  await page.keyboard.press('ArrowRight')
  await expect(themeRadio(page, '浅色'), '方向键选中浅色').toBeChecked()
  await expect(page.locator('html'), '方向键切换生效').toHaveAttribute('data-theme', 'light')
  await page.keyboard.press('ArrowRight')
  await expect(themeRadio(page, '深色'), '方向键选中深色').toBeChecked()
  await expect(page.locator('html'), '方向键切换生效').toHaveAttribute('data-theme', 'dark')
})

test('页头在四个验收宽度与双主题下不横向溢出', async ({ page }) => {
  for (const width of [...MOBILE_WIDTHS, DESKTOP_WIDTH]) {
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width, height: width < 768 ? 680 : 900 })
      await page.goto('/')
      await page.evaluate(
        (input: { key: string; value: string }) => window.localStorage.setItem(input.key, input.value),
        { key: THEME_STORAGE_KEY, value: theme },
      )
      await page.reload()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expectNoHorizontalOverflow(page, `${width}px/${theme}：收起时`)

      if (width < DESKTOP_WIDTH) {
        await trigger(page).click()
        await expectMenuOpen(page, `${width}px/${theme}：展开后`)
        await expectNoHorizontalOverflow(page, `${width}px/${theme}：展开时`)
      }
    }
  }
})

test.describe('无脚本', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 800 } })

  test('无脚本时菜单仍可展开，导航与主题分段可读，主题不改变', async ({ page }) => {
    await page.goto('/')

    // 无脚本时没有首帧引导，根元素不带 data-theme，由 tokens.css 的 prefers-color-scheme 兜底
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /[a-z]+/)

    // 原生 details：不依赖任何脚本就能展开
    await expectMenuClosed(page, '无脚本初始')
    await trigger(page).click()
    await expectMenuOpen(page, '无脚本展开后')
    await expectNavItems(page, '无脚本展开后')
    await expect(page.getByRole('navigation', { name: '站点导航' })).toBeVisible()
    await expect(themeGroup(page), '无脚本时的主题分段').toBeVisible()

    // 无脚本可选档，但主题不改变（计划 S1-T6 待确认项 8 记录的降级行为）
    await themeOption(page, '浅色').click()
    await expect(themeRadio(page, '浅色')).toBeChecked()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /[a-z]+/)
  })
})
