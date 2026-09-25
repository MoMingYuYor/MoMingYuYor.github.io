/**
 * 发布过滤：**所有公开入口共用这一条规则**（规格第 8 节）。
 * 详情路由、列表、首页、RSS、站点地图、结构化数据与分享元数据都必须消费同一结果，
 * 否则会出现"草稿只从列表隐藏、详情页却仍然生成"的漏洞。
 *
 * 日期按 **UTC 日** 比较而不是精确时刻：构建发生在发布日期当天的任意时刻都应视为已发布，
 * 否则会出现"本地已过零点、CI 还在前一天"导致条目随机消失。
 *
 * 纯函数、注入构建时钟，便于单测覆盖未来日期与边界。
 */

export type PublicationStatus = 'draft' | 'published'

export interface PublicationMeta {
  readonly publicationStatus: PublicationStatus
  readonly publishedAt?: Date
}

export type NotPublishedReason = 'draft' | 'missing-published-at' | 'future-published-at'

export interface PublicationDecision {
  readonly published: boolean
  readonly reason?: NotPublishedReason
}

/** 取 UTC 日的时间戳（当日零点），用于按天比较 */
function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function decidePublication(meta: PublicationMeta, now: Date): PublicationDecision {
  if (meta.publicationStatus !== 'published') return { published: false, reason: 'draft' }
  if (!meta.publishedAt) return { published: false, reason: 'missing-published-at' }
  if (utcDay(meta.publishedAt) > utcDay(now)) {
    return { published: false, reason: 'future-published-at' }
  }
  return { published: true }
}

export interface PublishableEntry {
  readonly id: string
  readonly data: PublicationMeta
}

/**
 * 按 slug 去重后筛出可公开条目。slug 重复属校验错误（见 `src/content/validate.ts`），
 * 这里保守地只保留第一次出现的那条，避免同一地址生成两份内容。
 */
export function selectPublished<T extends PublishableEntry>(
  entries: readonly T[],
  now: Date,
): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const entry of entries) {
    if (!decidePublication(entry.data, now).published) continue
    const slug = (entry.data as PublicationMeta & { slug?: string }).slug ?? entry.id
    if (seen.has(slug)) continue
    seen.add(slug)
    result.push(entry)
  }
  return result
}

export interface EntryRef {
  readonly collection: string
  readonly slug: string
}

/**
 * 过滤关联引用：只保留指向公开集合内存在的条目的引用。
 *
 * 计划里原写的是"定点迭代解析（A↔B 互相引用且一端为草稿时两者都不公开）"。
 * 这里改为"过滤 + 校验报错"，原因：`related` 是可选的内容增强，不是必需引用；
 * 因为关联的一篇文章还是草稿就把一个已发布的项目从站点上撤掉，会移除真实内容。
 * 悬空引用由校验器报错，不会静默存在。
 */
export function filterResolvableRefs(
  refs: readonly EntryRef[],
  publishedSlugs: ReadonlyMap<string, ReadonlySet<string>>,
): EntryRef[] {
  return refs.filter((ref) => publishedSlugs.get(ref.collection)?.has(ref.slug) ?? false)
}
