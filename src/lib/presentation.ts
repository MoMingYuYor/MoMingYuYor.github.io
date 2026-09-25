/**
 * 展示形态判定（规格第 11.2 节：内容感知布局）。
 *
 * 0 条 → 真实空状态；1 条 → 用完整可用区域，不出现索引布局或空侧栏；多条 → 才出现索引。
 * 单独抽出纯函数，便于固定边界并用单测守卫「不为了填侧栏造内容」这条设计约束。
 */

export type PresentationMode = 'empty' | 'single' | 'index'

export function selectPresentation(count: number): PresentationMode {
  if (count <= 0) return 'empty'
  return count === 1 ? 'single' : 'index'
}

export interface FeaturedCandidate {
  readonly data: {
    readonly featured?: boolean
    readonly publishedAt?: Date
    readonly slug: string
  }
}

/**
 * 精选条目：只取显式标记 featured 的条目，按发布日期倒序，再截断到 limit。
 * 没有精选时返回空数组——调用点据此省略整个模块，不拿最新条目冒充精选。
 */
export function pickFeatured<T extends FeaturedCandidate>(
  entries: readonly T[],
  limit: number,
): T[] {
  return entries
    .filter((entry) => entry.data.featured === true)
    .slice()
    .sort((left, right) => {
      const a = left.data.publishedAt?.getTime() ?? 0
      const b = right.data.publishedAt?.getTime() ?? 0
      if (a !== b) return b - a
      return left.data.slug.localeCompare(right.data.slug)
    })
    .slice(0, Math.max(0, limit))
}
