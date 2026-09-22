/**
 * 画廊状态与键盘导航的纯逻辑，兴趣与项目两个画廊共用，
 * 避免各自复制边界与回退规则。
 */

/** 删除条目后回退激活项：优先原位置的下一项，删末项则选前一项，空画廊为 null */
export function selectAfterRemoval<T extends { id: string }>(
  items: readonly T[],
  removedIndex: number,
): string | null {
  if (items.length === 0) return null
  const index = Math.min(Math.max(removedIndex, 0), items.length - 1)
  return items[index].id
}

/** 数据更新后规约激活项：仍存在则保留，否则回退第一项；空画廊为 null */
export function normalizeActiveId<T extends { id: string }>(
  items: readonly T[],
  activeId: string | null,
): string | null {
  if (items.length === 0) return null
  if (activeId !== null && items.some((item) => item.id === activeId)) return activeId
  return items[0].id
}

export type TabStep = 'next' | 'prev' | 'first' | 'last'
/** 键盘事件到移动语义的映射；方向键按标签栏的视觉方向解释 */
export function tabStepFromKey(key: string, orientation: 'vertical' | 'horizontal'): TabStep | null {
  const forward = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
  const backward = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
  if (key === forward) return 'next'
  if (key === backward) return 'prev'
  if (key === 'Home') return 'first'
  if (key === 'End') return 'last'
  return null
}

/** 移动语义到下标的映射；next/prev 在边界循环回绕，两种布局一致 */
export function stepIndex(current: number, count: number, step: TabStep): number {
  if (count === 0) return -1
  switch (step) {
    case 'first':
      return 0
    case 'last':
      return count - 1
    case 'next':
      return (current + 1) % count
    case 'prev':
      return (current - 1 + count) % count
  }
}

/** 图片失败状态按资源 URL 记录：主图与同 URL 缩略图共享；返回新增 url 后的新集合，输入不受影响 */
export function withFailedUrl(failed: ReadonlySet<string>, url: string): Set<string> {
  const next = new Set(failed)
  next.add(url)
  return next
}
