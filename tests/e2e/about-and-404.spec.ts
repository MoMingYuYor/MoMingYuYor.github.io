import { expect, test, type Page } from '@playwright/test'

/**
 * 关于页与 404 页的浏览器回归（规格第 2、3、11.2、12、13 节；计划 S1-T10）。
 *
 * 覆盖：两页可达且标题/摘要/canonical 独立、预览模式 noindex、关于页联系入口只出现一次
 * 且具备可访问名称、404 返回真实未找到状态与返回入口、320/390/1440 无整页横向溢出、
 * 双主题下文字对比度、无脚本时内容完整可读，以及"不展示编辑文案 / 不出现未经确认的个人事实"。
 *
 * 不覆盖：视觉基线（第四阶段 S4-T4）、跨浏览器（第四阶段 S4-T6）、读屏与 200% 文字缩放。
 * 404 状态码断言依据 `astro preview` 对缺失路径的实际行为；若与生产托管不一致，
 * 应记录差异，不得改断言掩盖。
 */

const ABOUT_PATH = '/about/'
const MISSING_PATH = '/this-path-does-not-exist/'

/** 布局验收宽度（规格第 13 节）：最窄、常见手机与桌面三档 */
const LAYOUT_WIDTHS = [320, 390, 1440] as const

/** 规格第 11.4 节：不向访客展示设计说明、组件说明、操作教程或"此处用于展示"等编辑文案 */
const EDITORIAL_COPY = /此处|用于展示|占位|演示|编辑说明/

/**
 * 硬约束：真实自述与经历由本人提供（第四阶段 S4-T2），开发代理不得补写。
 * 本断言守住"当前不存在未经确认的个人事实"。S4-T2 填入真实资料后，本断言按真实内容更新。
 */
const UNCONFIRMED_FACTS = /(本科|专科|硕士|博士|毕业|任职|就职|就任|工作年限|\d+\s*年经验)/

type Rgb = [number, number, number]

interface TextSample {
  readonly label: string
  readonly foreground: string
  readonly background: string
}

function parseColor(value: string): Rgb | null {
  const match = value.match(/rgba?\(([^)]+)\)/)
  if (!match) return null
  const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()))
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null
  return [parts[0], parts[1], parts[2]]
}

function relativeLuminance([red, green, blue]: Rgb): number {
  const channel = (value: number) => {
    const ratio = value / 255
    return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

/** 采集 main 内所有含文字元素的实际文字色与最近的不透明背景色 */
async function collectTextSamples(page: Page): Promise<TextSample[]> {
  return page.evaluate(() => {
    const samples: { label: string; foreground: string; background: string }[] = []
    const main = document.querySelector('main')
    if (!main) return samples

    const opaque = (value: string) =>
      value !== '' && value !== 'transparent' && !/,\s*0\)$/.test(value)

    main.querySelectorAll('h1, h2, h3, p, li, a, span').forEach((element) => {
      const text = (element.textContent ?? '').trim()
      if (text === '') return

      let node: Element | null = element
      let background = ''
      while (node && !opaque(background)) {
        background = getComputedStyle(node).backgroundColor
        node = node.parentElement
      }

      samples.push({
        label: `${element.tagName.toLowerCase()}"${text.slice(0, 24)}"`,
        foreground: getComputedStyle(element).color,
        background,
      })
    })

    return samples
  })
}

/** 正文文字对比度不低于 4.5:1（WCAG 2.2 AA 普通字号；规格第 13 节） */
async function expectReadableText(page: Page) {
  const samples = await collectTextSamples(page)
  expect(samples.length, 'main 内没有可检查的文字元素').toBeGreaterThan(0)

  const failures: string[] = []
  for (const sample of samples) {
    const foreground = parseColor(sample.foreground)
    const background = parseColor(sample.background)
    if (!foreground || !background) {
      failures.push(`${sample.label} 颜色无法解析（前景 ${sample.foreground} / 背景 ${sample.background}）`)
      continue
    }
    const ratio = contrastRatio(foreground, background)
    if (ratio < 4.5) {
      failures.push(
        `${sample.label} 对比度 ${ratio.toFixed(2)}:1（前景 ${sample.foreground} / 背景 ${sample.background}）`,
      )
    }
  }
  expect(failures, failures.join('\n')).toEqual([])
}

/** 整页横向溢出：滚动宽度不得超过可视宽度（规格第 13 节，代码与表格自身滚动容器除外） */
async function expectNoPageOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth }
  })
  // 允许 1px 取整误差，不掩盖真正的一行溢出
  expect(
    metrics.scrollWidth,
    `整页横向溢出：scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth}`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1)
}

test('关于页可达，标题、摘要与 canonical 独立', async ({ page }) => {
  const response = await page.goto(ABOUT_PATH)
  expect(response?.status()).toBe(200)

  await expect(page).toHaveTitle(/关于/)
  await expect(page).toHaveTitle(/MoMingYu/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /关注方向/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/about\/$/)

  await expect(page.locator('main h1')).toHaveCount(1)
  await expect(page.locator('main h1')).toHaveText('关于')
  for (const heading of ['关注方向', '自述', '经历', '联系']) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }

  // 已确认的关注方向文案来自站点配置，页面直接呈现
  await expect(page.locator('main')).toContainText('AI 全栈开发 · Agent 开发')
})

test('关于页联系入口只出现一次且具备可访问名称', async ({ page }) => {
  await page.goto(ABOUT_PATH)
  const main = page.locator('main')

  const mail = main.locator('a[href^="mailto:"]')
  await expect(mail).toHaveCount(1)
  await expect(mail).toHaveAccessibleName(/邮箱/)
  await expect(mail).toHaveAccessibleName(/MoMingYu0610@gmail\.com/)
  await expect(mail).toHaveAttribute('href', 'mailto:MoMingYu0610@gmail.com')

  const github = main.locator('a[href="https://github.com/MoMingYuYor"]')
  await expect(github).toHaveCount(1)
  await expect(github).toHaveAccessibleName(/GitHub/)
  await expect(github).toHaveAttribute('target', '_blank')
  await expect(github).toHaveAttribute('rel', 'noopener noreferrer')

  // 联系入口不在页面里重复堆叠，也不使用弹窗强迫联系
  await expect(main.locator('a[href*="github.com"]')).toHaveCount(1)
  expect(await page.locator('dialog').count()).toBe(0)
})

test('404 页返回真实未找到状态与返回入口', async ({ page }) => {
  const response = await page.goto(MISSING_PATH)
  // 静态托管由 dist/404.html 承担；astro preview 对缺失路径返回 404
  expect(response?.status()).toBe(404)

  await expect(page).toHaveTitle(/页面未找到/)
  await expect(page.locator('main h1')).toHaveCount(1)
  await expect(page.locator('main h1')).toHaveText('未找到该页面')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')

  // 返回入口指向首页，地址经路径函数生成（根路径部署下为 /）
  const home = page.locator('main').getByRole('link', { name: '返回首页' })
  await expect(home).toBeVisible()
  await expect(home).toHaveAttribute('href', '/')

  // 不依赖客户端通配路由或 meta 刷新掩盖 404
  await expect(page.locator('meta[http-equiv="refresh"]')).toHaveCount(0)
})

test('两页在预览模式下输出 noindex, nofollow', async ({ page }) => {
  for (const path of [ABOUT_PATH, MISSING_PATH]) {
    await page.goto(path)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  }
})

test('两页不展示设计说明或编辑文案，也不出现未经确认的个人事实', async ({ page }) => {
  for (const path of [ABOUT_PATH, MISSING_PATH]) {
    await page.goto(path)
    const text = await page.locator('main').innerText()
    expect(text, `${path} 出现了编辑文案`).not.toMatch(EDITORIAL_COPY)
    expect(text, `${path} 出现了未经确认的个人事实`).not.toMatch(UNCONFIRMED_FACTS)
  }
})

for (const width of LAYOUT_WIDTHS) {
  test(`${width}px 宽度下两页无整页横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    for (const path of [ABOUT_PATH, MISSING_PATH]) {
      await page.goto(path)
      await expectNoPageOverflow(page)
    }
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} 主题下两页文字可读`, async ({ page }) => {
    await page.addInitScript((value) => {
      try {
        window.localStorage.setItem('personal-home:theme', value)
      } catch {
        /* 存储不可用时由首帧脚本降级到系统偏好，不影响本断言 */
      }
    }, theme)

    for (const path of [ABOUT_PATH, MISSING_PATH]) {
      await page.goto(path)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expectReadableText(page)
    }
  })
}

test.describe('无脚本', () => {
  test.use({ javaScriptEnabled: false })

  test('关于页与 404 页在无脚本时内容完整可读', async ({ page }) => {
    await page.goto(ABOUT_PATH)
    await expect(page.locator('main h1')).toHaveText('关于')
    await expect(page.getByRole('heading', { name: '经历', exact: true })).toBeVisible()
    await expect(page.locator('main').getByRole('link', { name: /邮箱/ })).toBeVisible()
    await expect(page.locator('main').getByRole('link', { name: /GitHub/ })).toBeVisible()

    await page.goto(MISSING_PATH)
    await expect(page.locator('main h1')).toHaveText('未找到该页面')
    await expect(page.locator('main').getByRole('link', { name: '返回首页' })).toBeVisible()
  })
})
