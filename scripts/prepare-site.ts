import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { site } from '../src/content/site'
import { validateSiteContent } from '../src/content/validate'
import { checkLocalAssets } from './check-assets'

/** 项目根目录：脚本位于 scripts/ 下 */
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export interface SiteMeta {
  title: string
  description: string
  lang: string
  robots: string | null
  canonical: string | null
}

/** 对 HTML 属性与文本统一转义，注入值一律经过本函数 */
export function escapeHtml(value: string): string {
  const table: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return value.replace(/[&<>"']/g, (ch) => table[ch] ?? ch)
}

/** 只有 ready 且 allowIndex 才允许索引；其余一律 noindex, nofollow */
export function buildSiteMeta(content: typeof site): SiteMeta {
  const allowIndex = content.status === 'ready' && content.seo.allowIndex
  return {
    title: content.seo.title,
    description: content.seo.description,
    lang: content.seo.locale,
    robots: allowIndex ? null : 'noindex, nofollow',
    canonical: content.seo.canonicalUrl ?? null,
  }
}

export function renderMetaTags(meta: SiteMeta): string {
  const lines = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="zh_CN">`,
  ]
  if (meta.robots) lines.push(`<meta name="robots" content="${escapeHtml(meta.robots)}">`)
  if (meta.canonical) lines.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}">`)
  return lines.join('\n    ')
}

/** 无脚本最小说明中的联系入口：只使用已核验的 https 或 mailto 地址；缺失时留空 */
export function renderNoscriptContact(content: typeof site): string {
  const contact = content.contacts.find(
    (item) => item.href.startsWith('https://') || item.href.startsWith('mailto:'),
  )
  if (!contact) return ''
  return `或通过 <a href="${escapeHtml(contact.href)}">${escapeHtml(contact.label)}</a> 联系`
}

/**
 * 校验内容并把元数据写入构建中间文件（.generated/site-meta.json，可检视）。
 * 问题非空时抛错，由调用方（构建脚本、开发服务器）阻止流程。
 *
 * 两道关口（技术方案 6.3）：validateSiteContent 做无 DOM/无网络的纯结构校验，
 * checkLocalAssets 做本地媒体资源的文件系统检查（存在性、目录、越界与符号链接逃逸）。
 * 结构问题与资源问题一并报告，不互相掩盖。
 */
export function ensureSiteMeta(): string {
  const issues = [...validateSiteContent(site), ...checkLocalAssets(site, resolve(PROJECT_ROOT, 'public'))]
  if (issues.length > 0) {
    const detail = issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')
    throw new Error(`内容校验未通过，构建已阻止：\n${detail}`)
  }
  persistMetaFile(buildSiteMeta(site))
  return renderMetaTags(buildSiteMeta(site))
}

function persistMetaFile(meta: SiteMeta): void {
  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.generated/site-meta.json')
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(meta, null, 2), 'utf8')
}

/** 作为 CLI 直接运行时执行校验关口（被 vite.config 导入时不会触发） */
function isDirectRun(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(resolve(entry)).href
}

if (isDirectRun()) {
  try {
    ensureSiteMeta()
    console.log('内容校验通过，构建元数据已生成到 .generated/site-meta.json')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
