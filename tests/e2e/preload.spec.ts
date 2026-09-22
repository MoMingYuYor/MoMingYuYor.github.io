// 首屏预载验收（R06）：初次访问仅请求"有效主题 + 视口"对应的壁纸。
// 断言基于 page.on('request') 捕获的真实网络请求，而非 DOM 结构；
// 预览服务器由 playwright.config.ts 的 webServer 显式启动。
import { expect, test } from '@playwright/test'

/** 收集页面发起的 hero 壁纸请求 URL（页面自身加载与预载均计入） */
function trackHeroRequests(page: {
  on: (event: 'request', listener: (request: { url: () => string }) => void) => void
}): string[] {
  const requested: string[] = []
  page.on('request', (request) => {
    if (/hero-(light|dark)\.webp/.test(request.url())) requested.push(request.url())
  })
  return requested
}

test('系统浅色＋保存深色偏好：仅下载深色壁纸', async ({ page }) => {
  const requested = trackHeroRequests(page)
  await page.addInitScript(() => localStorage.setItem('personal-home:theme', 'dark'))
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/', { waitUntil: 'networkidle' })

  expect(requested.some((url) => url.includes('hero-light.webp'))).toBe(false)
  expect(requested.some((url) => url.includes('hero-dark.webp'))).toBe(true)
  // "只下载一张"：去重后恰好一个壁纸文件
  const files = new Set(requested.map((url) => url.split('/').at(-1)))
  expect([...files]).toEqual(['hero-dark.webp'])
})

test('系统深色＋保存浅色偏好：仅下载浅色壁纸', async ({ page }) => {
  const requested = trackHeroRequests(page)
  await page.addInitScript(() => localStorage.setItem('personal-home:theme', 'light'))
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/', { waitUntil: 'networkidle' })

  expect(requested.some((url) => url.includes('hero-dark.webp'))).toBe(false)
  expect(requested.some((url) => url.includes('hero-light.webp'))).toBe(true)
  const files = new Set(requested.map((url) => url.split('/').at(-1)))
  expect([...files]).toEqual(['hero-light.webp'])
})

test('跟随系统（未保存偏好）：仅下载系统主题对应的壁纸', async ({ page }) => {
  const requested = trackHeroRequests(page)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/', { waitUntil: 'networkidle' })

  expect(requested.some((url) => url.includes('hero-dark.webp'))).toBe(false)
  expect(requested.some((url) => url.includes('hero-light.webp'))).toBe(true)
  const files = new Set(requested.map((url) => url.split('/').at(-1)))
  expect([...files]).toEqual(['hero-light.webp'])
})

test.describe('窄视口（当前内容无 mobileSrc，回退主图 src 路径）', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('窄视口＋保存深色偏好：仅下载深色壁纸', async ({ page }) => {
    const requested = trackHeroRequests(page)
    await page.addInitScript(() => localStorage.setItem('personal-home:theme', 'dark'))
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/', { waitUntil: 'networkidle' })

    expect(requested.some((url) => url.includes('hero-light.webp'))).toBe(false)
    expect(requested.some((url) => url.includes('hero-dark.webp'))).toBe(true)
    const files = new Set(requested.map((url) => url.split('/').at(-1)))
    expect([...files]).toEqual(['hero-dark.webp'])
  })
})
