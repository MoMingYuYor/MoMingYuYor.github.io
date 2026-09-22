import { expect, test, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * 页脚与联系入口的浏览器回归（S1-T7）。
 *
 * 依据：规格第 2 节（页脚提供 GitHub、邮箱与具备公开文章时的订阅入口）、第 3 节（联系入口沿用
 * 已确认的 GitHub 与邮箱）、第 11.4 节（图标具备可访问名称、44px 触摸目标、键盘焦点可见、
 * 不向访客展示编辑文案）、第 12 节（外链规则）、第 13 节（除局部滚动容器外不允许整页横向溢出）。
 *
 * 期望地址在此显式声明：`src/lib/site.ts` 在模块顶层读取 `import.meta.env`，
 * 不能在 Playwright 进程里导入，因此它的 `contacts` 值在这里以期望值形式复述。
 * 主题存储键与 `src/lib/theme.ts` 的 `THEME_STORAGE_KEY` 一致。
 *
 * 未覆盖（如实标注）：真机触控、读屏实际播报、200% 文字缩放、跨浏览器（本阶段只跑系统 Chrome）、
 * 视觉基线（第四阶段 S4-T4）。
 */

const THEME_STORAGE_KEY = 'personal-home:theme'
const GITHUB_HREF = 'https://github.com/MoMingYuYor'
const MAIL_HREF = 'mailto:MoMingYu0610@gmail.com'

/** 布局验收宽度（规格第 13 节）；页脚在四个宽度与双主题下都不得溢出 */
const WIDTHS = [320, 390, 768, 1024]
const THEMES = ['light', 'dark'] as const

/** 页脚不得出现的编辑说明措辞（规格第 11.4 节；跨计划裁决 R12 由第四阶段承担发布阻断） */
const FORBIDDEN_EDITORIAL_WORDS = ['示意', '待补充', '此处用于展示', '占位', 'Lorem', 'TODO']

/** 版权年份：构建与测试在同一次运行内完成，因此与测试进程的年份一致 */
function currentYear(): number {
  return new Date().getFullYear()
}

/** 打开首页并落到指定主题（经真实的首帧引导脚本生效，而不是直接改属性） */
async function openWithTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.goto('/')
  await page.evaluate(
    (input: { key: string; value: string }) => {
      window.localStorage.setItem(input.key, input.value)
    },
    { key: THEME_STORAGE_KEY, value: theme },
  )
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
}

test('页脚在双主题与 320/390/768/1024 宽度下可见且不溢出', async ({ page }) => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width < 768 ? 680 : 900 })
      await openWithTheme(page, theme)

      const footer = page.getByRole('contentinfo')
      await expect(footer).toBeVisible()
      await expect(footer.getByText(`© ${currentYear()}`, { exact: false })).toBeVisible()
      await expect(footer.getByRole('link', { name: 'GitHub' })).toBeVisible()
      await expect(footer.getByRole('link', { name: '邮箱' })).toBeVisible()

      // 页脚自身不越出视口
      const box = await footer.boundingBox()
      expect(box, `${theme} / ${width}px：页脚应可测量`).not.toBeNull()
      expect(box!.x, `${theme} / ${width}px：页脚左边界`).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width, `${theme} / ${width}px：页脚右边界`).toBeLessThanOrEqual(width + 1)

      // 整页无横向溢出（1px 容差用于子像素取整）
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(
        metrics.scrollWidth,
        `${theme} / ${width}px：整页横向溢出 ${metrics.scrollWidth} > ${metrics.clientWidth}`,
      ).toBeLessThanOrEqual(metrics.clientWidth + 1)
    }
  }
})

test('外链带 rel="noopener noreferrer" 与明确 target，邮箱链接不带 target', async ({ page }) => {
  await page.goto('/')
  const footer = page.getByRole('contentinfo')

  const github = footer.getByRole('link', { name: 'GitHub' })
  await expect(github).toHaveAttribute('href', GITHUB_HREF)
  await expect(github).toHaveAttribute('target', '_blank')
  await expect(github).toHaveAttribute('rel', 'noopener noreferrer')

  const mail = footer.getByRole('link', { name: '邮箱' })
  await expect(mail).toHaveAttribute('href', MAIL_HREF)
  // mailto: 没有「新标签页」语义，不应带 target 与 rel
  expect(await mail.getAttribute('target')).toBeNull()
  expect(await mail.getAttribute('rel')).toBeNull()
})

test('联系图标具备可访问名称，采用 Lucide 规格，并显示可见标签', async ({ page }) => {
  await page.goto('/')
  const footer = page.getByRole('contentinfo')

  for (const name of ['GitHub', '邮箱']) {
    const icon = footer.getByRole('img', { name })
    await expect(icon).toBeVisible()
    // Lucide 规格：24 网格、2px 线宽、圆角端点；尺寸取 20 档
    await expect(icon).toHaveAttribute('viewBox', '0 0 24 24')
    await expect(icon).toHaveAttribute('width', '20')
    await expect(icon).toHaveAttribute('height', '20')
    await expect(icon).toHaveAttribute('stroke-width', '2')
    await expect(icon).toHaveAttribute('stroke-linecap', 'round')
    await expect(icon).toHaveAttribute('stroke-linejoin', 'round')
    await expect(icon).toHaveAttribute('focusable', 'false')

    // 触屏用户无法靠悬停了解陌生图标，因此关键联系位置必须有可见标签
    const label = footer.locator('.contact-entry__label', { hasText: name })
    await expect(label).toBeVisible()
    await expect(label).toHaveText(name)
  }

  // 图标带可访问名称时链接名不应被拼成重复文本
  await expect(footer.getByRole('link', { name: 'GitHub', exact: true })).toHaveCount(1)
  await expect(footer.getByRole('link', { name: '邮箱', exact: true })).toHaveCount(1)
})

test('页脚只提供一处 GitHub 与一处邮箱入口，且当前不渲染订阅入口', async ({ page }) => {
  await page.goto('/')
  const footer = page.getByRole('contentinfo')

  // 联系入口不重复堆叠
  await expect(footer.locator(`a[href="${GITHUB_HREF}"]`)).toHaveCount(1)
  await expect(footer.locator('a[href^="mailto:"]')).toHaveCount(1)

  // 订阅入口只留接入位（第三阶段 S3-T9 在存在公开文章时接入）：
  // 订阅产物不存在时，页脚不得出现指向它的失效入口；产物存在时才允许有一条订阅入口。
  const rssBuilt = existsSync(fileURLToPath(new URL('../../dist/rss.xml', import.meta.url)))
  const subscribeLinks = footer.locator('a[href$="rss.xml"], a[href$="feed.xml"], a[href$="atom.xml"]')
  await expect(subscribeLinks, `dist/rss.xml 存在：${rssBuilt}`).toHaveCount(rssBuilt ? 1 : 0)

  // 不保留占位按钮（规格第 2 节：没有公开条目时不留假入口）
  await expect(footer.locator('button, input[type="submit"]')).toHaveCount(0)
})

test('页脚不渲染设计说明或编辑文案', async ({ page }) => {
  await page.goto('/')
  const footer = page.getByRole('contentinfo')
  const text = (await footer.innerText()).replace(/\s+/g, '')

  for (const word of FORBIDDEN_EDITORIAL_WORDS) {
    expect(text, `页脚不应出现编辑说明「${word}」`).not.toContain(word)
  }
})

test('页脚联系区是可命名地标，触摸目标不小于 44px，键盘焦点可见', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const footer = page.getByRole('contentinfo')

  await expect(footer.getByRole('navigation', { name: '联系方式' })).toBeVisible()

  const github = footer.getByRole('link', { name: 'GitHub' })
  const box = await github.boundingBox()
  expect(box, '联系入口应可测量').not.toBeNull()
  expect(box!.height, '触摸目标高度以 44px 为设计目标').toBeGreaterThanOrEqual(43.5)
  expect(box!.width, '触摸目标宽度以 44px 为设计目标').toBeGreaterThanOrEqual(43.5)

  // 用键盘把焦点移到页脚第一个联系入口
  let focused = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.keyboard.press('Tab')
    if (await github.evaluate((el) => el === document.activeElement)) {
      focused = true
      break
    }
  }
  expect(focused, '未能在 40 次 Tab 内聚焦页脚联系入口').toBe(true)

  const focusStyle = await github.evaluate((el) => {
    const style = window.getComputedStyle(el)
    return {
      matchesFocusVisible: el.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    }
  })
  expect(focusStyle.matchesFocusVisible, '键盘聚焦应命中 :focus-visible').toBe(true)
  expect(focusStyle.outlineStyle, '焦点轮廓不得为 none').not.toBe('none')
  expect(
    Number.parseFloat(focusStyle.outlineWidth),
    '焦点轮廓宽度应大于 0',
  ).toBeGreaterThan(0)
})

test('无脚本时页脚内容仍完整可读', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/')

  const footer = page.getByRole('contentinfo')
  await expect(footer).toBeVisible()

  const text = await footer.innerText()
  expect(text, '版权年份应出现在静态 HTML 中').toContain(String(currentYear()))
  expect(text).toContain('GitHub')
  expect(text).toContain('邮箱')

  await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', GITHUB_HREF)
  await expect(footer.getByRole('link', { name: '邮箱' })).toHaveAttribute('href', MAIL_HREF)

  await context.close()
})

test('版权年份写入构建产物，不由客户端时钟计算', async () => {
  // 相对测试文件定位产物，不依赖调用时的工作目录
  const distIndex = fileURLToPath(new URL('../../dist/index.html', import.meta.url))
  const html = readFileSync(distIndex, 'utf8')
  const footerHtml = html.slice(html.indexOf('<footer'))

  expect(footerHtml, '构建产物应含页脚').not.toBe('')
  expect(footerHtml, '版权年份应在构建期写入 HTML').toContain(String(currentYear()))
  // 断言范围限定在页脚：整页含客户端日期脚本是预期的（首页身份区的日期与问候要按访客本地时间重算），
  // 这里要守的是"页脚年份不依赖客户端时钟"
  expect(footerHtml, '页脚不得含脚本').not.toMatch(/<script/)
  expect(footerHtml, '页脚不得用客户端时钟计算年份').not.toMatch(/getFullYear/)
})
