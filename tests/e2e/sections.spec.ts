import { expect, test, type Page } from '@playwright/test'

/**
 * 三个栏目索引骨架与章节头的浏览器回归（规格第 2、3、11.2、11.3、13 节；计划 S1-T9）。
 *
 * 覆盖：`/projects/`、`/hardware/`、`/blog/` 三页可达且各自标题、摘要、canonical 独立；
 * 章节头组件（`SectionHeader`）的 DOM 契约与 section 的可访问名称；
 * 每页的诚实空状态、不出现编辑文案、不出现假列表/假封面/假日期/假条目；
 * `/hardware/` 当前不输出指向尚不存在的 `/hardware/builds/`、`/hardware/overclocking/` 的链接；
 * 页内链接无死链；320/390/1440 无整页横向溢出；双主题下文字可读；无脚本时内容完整可读；
 * 三页在预览模式下输出 `noindex, nofollow`。
 *
 * 未覆盖（如实标注）：视觉基线（第四阶段 S4-T4）、跨浏览器（第四阶段 S4-T6）、
 * 真机触控、读屏实际播报、200% 文字缩放。`SectionHeader` 的 `id` 省略分支
 * （不传 id 时不输出 id 属性）在当前三页中没有调用点，无法在浏览器中断言，见交付说明。
 */

/** 三个栏目索引骨架页；标题、章节头与空状态文案在此显式声明 */
const SECTIONS = [
  {
    path: '/projects/',
    label: '作品',
    descriptionHint: /软件项目索引/,
    canonical: /\/projects\/$/,
    headings: ['软件项目'],
    emptyStates: ['暂无公开作品。'],
  },
  {
    path: '/hardware/',
    label: '硬件',
    descriptionHint: /装机|超频/,
    canonical: /\/hardware\/$/,
    headings: ['装机记录', '超频实验'],
    emptyStates: ['暂无公开装机记录。', '暂无公开超频记录。'],
  },
  {
    path: '/blog/',
    label: '文章',
    descriptionHint: /文章索引/,
    canonical: /\/blog\/$/,
    headings: ['全部文章'],
    emptyStates: ['暂无公开文章。'],
  },
] as const

/** 布局验收宽度（规格第 13 节）：最窄、常见手机与桌面三档 */
const LAYOUT_WIDTHS = [320, 390, 1440] as const

/** 规格第 11.4 节：不向访客展示设计说明、组件说明、操作教程或"此处用于展示"等编辑文案 */
const EDITORIAL_COPY = /此处|用于展示|占位|待补充|示意|演示|编辑说明|Lorem|TODO/

/** 第三阶段 S3-T8 建立分区页之后才存在的路径；本阶段不得输出指向它们的链接 */
const NOT_YET_EXISTING_PATHS = ['/hardware/builds/', '/hardware/overclocking/']

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

test('三个索引页可达，标题、摘要与 canonical 各自独立', async ({ page }) => {
  const descriptions: string[] = []

  for (const section of SECTIONS) {
    const response = await page.goto(section.path)
    expect(response?.status(), `${section.path} 应返回 200`).toBe(200)

    // 独立标题：栏目名 + 站点品牌
    await expect(page).toHaveTitle(new RegExp(section.label))
    await expect(page).toHaveTitle(/MoMingYu/)

    // 独立摘要
    const description = await page.locator('meta[name="description"]').getAttribute('content')
    expect(description, `${section.path} 缺少摘要`).toBeTruthy()
    expect(description!, `${section.path} 摘要未描述本栏目`).toMatch(section.descriptionHint)
    descriptions.push(description!)

    // canonical 由 BaseLayout 生成，指向本页绝对地址
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', section.canonical)

    // 文档大纲：一个 h1（栏目名）+ 每节一个 h2
    await expect(page.locator('main h1')).toHaveCount(1)
    await expect(page.locator('main h1')).toHaveText(section.label)
    await expect(page.locator('main h2')).toHaveCount(section.headings.length)

    // 无脚本可读：标题与空状态都在首份 HTML 里，且可见
    await expect(page.locator('main h1')).toBeVisible()
  }

  expect(new Set(descriptions).size, '三页摘要不得重复').toBe(SECTIONS.length)
})

test('章节头组件输出约定的 DOM 结构，section 的可访问名称来自它', async ({ page }) => {
  for (const section of SECTIONS) {
    await page.goto(section.path)
    const headers = page.locator('main .section-header')
    await expect(headers).toHaveCount(section.headings.length)

    for (const [index, heading] of section.headings.entries()) {
      const header = headers.nth(index)

      // 编号是金色承担的小面积装饰，按顺序从 01 起
      await expect(header.locator('.section-header__number')).toHaveText(
        String(index + 1).padStart(2, '0'),
      )

      // 标题固定为 h2，并带供 aria-labelledby 引用的 id
      const title = header.locator('h2.section-header__title')
      await expect(title).toHaveText(heading)
      const id = await title.getAttribute('id')
      expect(id, `${section.path} 的「${heading}」章节标题缺少 id`).toBeTruthy()

      // section 的可访问名称由该 id 提供，能被 role=region 查询到
      const region = page.getByRole('region', { name: heading })
      await expect(region).toBeVisible()
      await expect(region.locator('h2.section-header__title')).toHaveText(heading)
    }
  }

  // 引导句只在提供了它的章节出现（`/hardware/` 的两个方向）
  await page.goto('/hardware/')
  await expect(page.locator('main .section-header__lead')).toHaveCount(2)
  await expect(page.locator('main .section-header__lead').first()).toHaveText(/用途与约束/)
  await expect(page.locator('main .section-header__lead').last()).toHaveText(/测试平台/)
})

test('每页是诚实空状态：无假列表、假封面、假日期、假条目，且不含编辑文案', async ({ page }) => {
  for (const section of SECTIONS) {
    await page.goto(section.path)
    const main = page.locator('main')

    // 诚实空状态：真实的"暂无"文案，而不是空容器
    for (const emptyState of section.emptyStates) {
      await expect(main.getByText(emptyState, { exact: true })).toBeVisible()
    }

    // 零公开条目时不渲染空列表容器、假封面、假日期、假条目
    expect(await main.locator('ul, ol').count(), `${section.path} 渲染了列表容器`).toBe(0)
    expect(await main.locator('img, picture').count(), `${section.path} 渲染了图片`).toBe(0)
    expect(await main.locator('time').count(), `${section.path} 渲染了日期`).toBe(0)
    expect(await main.locator('article').count(), `${section.path} 渲染了条目`).toBe(0)

    // 不向访客展示设计说明、组件说明或编辑提示
    const text = await main.innerText()
    expect(text, `${section.path} 出现了编辑文案`).not.toMatch(EDITORIAL_COPY)

    // 返回入口存在且指向首页
    const back = main.getByRole('link', { name: '返回首页' })
    await expect(back).toBeVisible()
    await expect(back).toHaveAttribute('href', '/')
  }
})

test('/hardware/ 用文字呈现 DIY 与超频两个方向，且不链接到尚不存在的分区路径', async ({ page }) => {
  await page.goto('/hardware/')

  // 两个方向各自有标题与说明文字
  await expect(page.getByRole('heading', { name: '装机记录', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '超频实验', exact: true })).toBeVisible()
  await expect(page.locator('main')).toContainText('电脑 DIY 与硬件超频实践。')

  // 第三阶段 S3-T8 才建立分区页；本阶段输出指向它们的链接会产生 404 入口
  for (const path of NOT_YET_EXISTING_PATHS) {
    expect(
      await page.locator(`a[href*="${path}"]`).count(),
      `/hardware/ 输出了指向 ${path} 的链接，该路径当前不存在`,
    ).toBe(0)
  }

  // 反向确认链接检查本身有效：导航里确实存在指向 /hardware/ 的链接
  expect(await page.locator('a[href="/hardware/"]').count()).toBeGreaterThan(0)
})

test('三个索引页的页内链接都指向可访问的地址', async ({ page }) => {
  for (const section of SECTIONS) {
    await page.goto(section.path)
    const hrefs = await page.locator('main a[href]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? ''),
    )
    expect(hrefs.length, `${section.path} 没有可检查的链接`).toBeGreaterThan(0)

    for (const href of hrefs) {
      expect(href.startsWith('/'), `${section.path} 出现非站内链接：${href}`).toBe(true)
      // 用当前页面地址解析成绝对地址，不依赖请求上下文的 baseURL 继承
      const response = await page.request.get(new URL(href, page.url()).href)
      expect(response.status(), `${section.path} 的链接 ${href} 不可达`).toBe(200)
    }
  }
})

test('三个索引页在预览模式下输出 noindex, nofollow', async ({ page }) => {
  for (const section of SECTIONS) {
    await page.goto(section.path)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  }
})

for (const width of LAYOUT_WIDTHS) {
  test(`${width}px 宽度下三个索引页无整页横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 680 : 900 })
    for (const section of SECTIONS) {
      await page.goto(section.path)
      await expectNoPageOverflow(page)

      // 手机最小水平留白 16px：正文容器不贴边
      const gutter = await page.evaluate(() => {
        const intro = document.querySelector('main .container > *')
        return intro ? intro.getBoundingClientRect().x : -1
      })
      expect(gutter, `${section.path} 在 ${width}px 下正文贴边`).toBeGreaterThanOrEqual(16)
    }
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} 主题下三个索引页文字可读`, async ({ page }) => {
    await page.addInitScript((value) => {
      try {
        window.localStorage.setItem('personal-home:theme', value)
      } catch {
        /* 存储不可用时由首帧脚本降级到系统偏好，不影响本断言 */
      }
    }, theme)

    for (const section of SECTIONS) {
      await page.goto(section.path)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expectReadableText(page)
    }
  })
}

test.describe('无脚本', () => {
  test.use({ javaScriptEnabled: false })

  test('三个索引页在无脚本时内容完整可读', async ({ page }) => {
    for (const section of SECTIONS) {
      await page.goto(section.path)
      await expect(page.locator('main h1')).toHaveText(section.label)
      for (const heading of section.headings) {
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      }
      for (const emptyState of section.emptyStates) {
        await expect(page.locator('main').getByText(emptyState, { exact: true })).toBeVisible()
      }
      await expect(page.locator('main').getByRole('link', { name: '返回首页' })).toBeVisible()
    }
  })
})
