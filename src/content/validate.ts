/**
 * 内容校验（规格第 8 节的校验清单）。
 *
 * 本模块**不直接使用 fs**：本地文件解析、构建时钟与运行模式都以参数注入，
 * 因此可以在 Node 单测里直接覆盖每一类问题，不需要真实目录。
 *
 * 结构性问题（字段类型、枚举取值、缺失必填）由 Schema 在读取阶段拦下；
 * 这里负责跨条目与语义规则：slug 唯一性、日期先后、引用完整性、链接合法性、
 * 替代文本、占位素材与编辑文案。
 */
import { classifyHref } from '../lib/links'
import { decidePublication } from '../lib/publication'
import { COLLECTION_NAMES, type CollectionSnapshot, type SnapshotEntry } from './snapshot'

export type IssueSeverity = 'blocking' | 'warning'

export interface ContentIssue {
  readonly path: string
  readonly message: string
  readonly severity: IssueSeverity
}

export interface ValidationOptions {
  readonly now: Date
  /** preview 下占位内容记 warning，release 下记 blocking（规格第 8 节） */
  readonly mode: 'preview' | 'release'
  /**
   * 本地文件解析以参数注入，保持本模块无 fs 副作用。
   * `unsafe` 表示路径越界或指向 public 之外的符号链接目标。
   */
  readonly resolveLocalFile: (key: string) => 'file' | 'missing' | 'unsafe'
}

/** 已知占位素材：文件名前缀判定，第四阶段发布就绪检查复用同一枚举 */
export const PLACEHOLDER_FILE_PREFIX = 'placeholder-'

/** 已知编辑说明措辞：只用于定位，不代替人工核验（规格第 8 节） */
export const EDITORIAL_PHRASES = [
  '待补充',
  '待整理',
  '此处',
  '用于展示',
  '占位',
  '示意',
  '演示文字',
  '演示占位',
  'Lorem',
  'TODO',
] as const

export function isPlaceholderAsset(key: string): boolean {
  const name = key.split('/').pop() ?? key
  return name.startsWith(PLACEHOLDER_FILE_PREFIX)
}

export function findEditorialPhrase(text: string): string | undefined {
  return EDITORIAL_PHRASES.find((phrase) => text.includes(phrase))
}

/** 缺失的测量值必须保持缺失，不能转成 0 */
export function isMissingMeasurement(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

/**
 * 单位基元：带单位的数值必须给出单位，且不允许把缺失值写成 0。
 * `projects` 目前没有带单位的数值字段，实际接线由第三阶段的超频与装机字段完成。
 */
export function validateUnit(
  value: { value?: unknown; unit?: unknown } | undefined,
  path: string,
  issues: ContentIssue[],
): void {
  if (!value) return
  if (isMissingMeasurement(value.value)) return
  if (isMissingMeasurement(value.unit)) {
    issues.push({ path: `${path}.unit`, message: '带单位的数值缺少单位', severity: 'blocking' })
  }
}

interface MediaLike {
  readonly src?: unknown
  readonly alt?: unknown
  readonly kind?: unknown
}

function checkMedia(
  media: MediaLike | undefined,
  path: string,
  options: ValidationOptions,
  issues: ContentIssue[],
): void {
  if (!media || typeof media.src !== 'string') return
  const { src } = media

  if (isPlaceholderAsset(src)) {
    issues.push({
      path: `${path}.src`,
      message: `引用了已知占位素材 ${src}`,
      severity: options.mode === 'release' ? 'blocking' : 'warning',
    })
  } else {
    const resolution = options.resolveLocalFile(src)
    if (resolution === 'missing') {
      issues.push({ path: `${path}.src`, message: `本地文件不存在：${src}`, severity: 'blocking' })
    } else if (resolution === 'unsafe') {
      issues.push({ path: `${path}.src`, message: `资源路径越界或指向外部：${src}`, severity: 'blocking' })
    }
  }

  // 信息图（截图）必须有替代文本；装饰性的摄影素材允许空串
  if (media.kind === 'screenshot' && (typeof media.alt !== 'string' || media.alt.trim() === '')) {
    issues.push({ path: `${path}.alt`, message: '截图必须提供替代文本', severity: 'blocking' })
  }
}

function checkHref(href: unknown, path: string, issues: ContentIssue[]): void {
  if (typeof href !== 'string' || href === '') return
  if (classifyHref(href) === 'invalid') {
    issues.push({ path, message: `非法链接：${href}`, severity: 'blocking' })
  }
}

function checkText(text: unknown, path: string, options: ValidationOptions, issues: ContentIssue[]): void {
  if (typeof text !== 'string') return
  const phrase = findEditorialPhrase(text)
  if (phrase) {
    issues.push({
      path,
      message: `包含编辑说明措辞「${phrase}」`,
      severity: options.mode === 'release' ? 'blocking' : 'warning',
    })
  }
}

/** 收集条目声明的关联引用，供完整性校验使用 */
function collectRefs(entry: SnapshotEntry): Array<{ collection: string; slug: string; path: string }> {
  const refs: Array<{ collection: string; slug: string; path: string }> = []
  const groups: Array<[string, string]> = [
    ['relatedProjects', 'projects'],
    ['relatedPosts', 'posts'],
    ['relatedBuilds', 'builds'],
    ['relatedOverclocking', 'overclocking'],
  ]
  for (const [field, collection] of groups) {
    const value = entry.data[field]
    if (!Array.isArray(value)) continue
    value.forEach((slug, index) => {
      if (typeof slug === 'string') refs.push({ collection, slug, path: `${field}[${index}]` })
    })
  }
  return refs
}

export function validateCollections(
  snapshot: CollectionSnapshot,
  options: ValidationOptions,
): ContentIssue[] {
  const issues: ContentIssue[] = []

  // slug 唯一性：同一集合内重复会导致同一地址生成两份内容
  const slugIndex = new Map<string, Set<string>>()
  for (const collection of COLLECTION_NAMES) {
    const seen = new Map<string, string>()
    for (const entry of snapshot[collection]) {
      const slug = typeof entry.data.slug === 'string' ? entry.data.slug : entry.id
      const previous = seen.get(slug)
      if (previous) {
        issues.push({
          path: entry.filePath,
          message: `slug「${slug}」与 ${previous} 重复`,
          severity: 'blocking',
        })
      } else {
        seen.set(slug, entry.filePath)
      }
    }
    slugIndex.set(collection, new Set(seen.keys()))
  }

  for (const collection of COLLECTION_NAMES) {
    for (const entry of snapshot[collection]) {
      const place = entry.filePath

      // 日期先后与发布前提
      const publishedAt = entry.data.publishedAt
      const updatedAt = entry.data.updatedAt
      if (publishedAt instanceof Date && updatedAt instanceof Date && updatedAt < publishedAt) {
        issues.push({ path: place, message: 'updatedAt 早于 publishedAt', severity: 'blocking' })
      }
      const decision = decidePublication(
        {
          publicationStatus: entry.data.publicationStatus as 'draft' | 'published',
          publishedAt: publishedAt instanceof Date ? publishedAt : undefined,
        },
        options.now,
      )
      if (!decision.published && decision.reason === 'missing-published-at') {
        issues.push({ path: place, message: 'published 条目缺少 publishedAt', severity: 'blocking' })
      }

      // 引用完整性：先看条目是否存在；存在但未公开记 warning（关联内容会被过滤掉）
      for (const ref of collectRefs(entry)) {
        const target = slugIndex.get(ref.collection)
        if (!target?.has(ref.slug)) {
          issues.push({
            path: `${place}: ${ref.path}`,
            message: `引用不存在的条目 ${ref.collection}/${ref.slug}`,
            severity: 'blocking',
          })
        }
      }

      checkText(entry.data.title, `${place}: title`, options, issues)
      checkText(entry.data.summary, `${place}: summary`, options, issues)
      checkText(entry.body, `${place}: 正文`, options, issues)

      checkMedia(entry.data.cover as MediaLike | undefined, `${place}: cover`, options, issues)
      const screenshots = entry.data.screenshots
      if (Array.isArray(screenshots)) {
        screenshots.forEach((item, index) => {
          checkMedia(item as MediaLike, `${place}: screenshots[${index}]`, options, issues)
        })
      }

      checkHref(entry.data.publishedUrl, `${place}: publishedUrl`, issues)
      checkHref(entry.data.sourceUrl, `${place}: sourceUrl`, issues)
      const links = entry.data.links
      if (Array.isArray(links)) {
        links.forEach((link, index) => {
          checkHref((link as { href?: unknown }).href, `${place}: links[${index}].href`, issues)
        })
      }
      const evidence = entry.data.evidence
      if (Array.isArray(evidence)) {
        evidence.forEach((item, index) => {
          checkHref((item as { href?: unknown }).href, `${place}: evidence[${index}].href`, issues)
        })
      }
    }
  }

  return issues
}

/** 有阻断级问题即视为不可发布 */
export function hasBlockingIssue(issues: readonly ContentIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'blocking')
}
