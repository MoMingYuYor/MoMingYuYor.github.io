import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

/**
 * 作品索引与详情（S2-T5）。
 * 公开构建里唯一的项目条目是 draft，因此公开形态应当是"真实空状态 + 没有详情页"。
 */

const distProjectsIndex = fileURLToPath(new URL('../../dist/projects/index.html', import.meta.url))
const distDraftDetail = fileURLToPath(
  new URL('../../dist/projects/ai-desk-companion/index.html', import.meta.url),
)

test('草稿不生成详情页，也不进入索引产物', () => {
  expect(existsSync(distDraftDetail), '草稿条目不得生成任何详情 HTML').toBe(false)

  const html = readFileSync(distProjectsIndex, 'utf8')
  expect(html).toContain('暂无公开作品。')
  expect(html).not.toContain('ai-desk-companion')
})

test('索引页直接访问可读，且不依赖客户端初始化', async ({ page }) => {
  const response = await page.goto('/projects/')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: '作品' })).toBeVisible()
  await expect(page.locator('[data-presentation="empty"]')).toHaveAttribute(
    'data-presentation',
    'empty',
  )
})

test('空状态不渲染空列表容器，也不出现假封面与编辑文案', async ({ page }) => {
  await page.goto('/projects/')
  const main = page.locator('main')
  await expect(main.locator('ul')).toHaveCount(0)
  await expect(main.locator('img')).toHaveCount(0)
  const text = await main.innerText()
  expect(text).not.toMatch(/此处|用于展示|占位|待补充|示意|演示|编辑说明|Lorem|TODO/)
})

test('未知 slug 返回 404 页面', async ({ page }) => {
  const response = await page.goto('/projects/this-project-does-not-exist/')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('未找到')
})

test('刷新后仍可读，且不依赖首页初始化', async ({ page }) => {
  await page.goto('/projects/')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: '作品' })).toBeVisible()
})

test('无脚本时索引页内容完整可读', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/projects/')
  await expect(page.getByRole('heading', { level: 1, name: '作品' })).toBeVisible()
  await expect(page.getByText('暂无公开作品。')).toBeVisible()
  await context.close()
})

test('预览阶段索引页输出 noindex', async ({ page }) => {
  await page.goto('/projects/')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
})
