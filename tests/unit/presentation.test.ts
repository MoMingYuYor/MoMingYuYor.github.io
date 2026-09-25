import { describe, expect, it } from 'vitest'

import { pickFeatured, selectPresentation } from '../../src/lib/presentation'

describe('selectPresentation', () => {
  it('0 条与负数都是空状态', () => {
    expect(selectPresentation(0)).toBe('empty')
    expect(selectPresentation(-1)).toBe('empty')
  })

  it('1 条用完整可用区域，不进入索引布局', () => {
    expect(selectPresentation(1)).toBe('single')
  })

  it('多条才出现索引布局', () => {
    expect(selectPresentation(2)).toBe('index')
    expect(selectPresentation(10)).toBe('index')
  })
})

describe('pickFeatured', () => {
  const entries = [
    { data: { slug: 'a', featured: true, publishedAt: new Date('2026-09-01') } },
    { data: { slug: 'b', featured: false, publishedAt: new Date('2026-09-05') } },
    { data: { slug: 'c', featured: true, publishedAt: new Date('2026-09-03') } },
  ]

  it('只返回显式标记为精选的条目', () => {
    expect(pickFeatured(entries, 10).map((entry) => entry.data.slug)).toEqual(['c', 'a'])
  })

  it('按发布日期倒序并截断', () => {
    expect(pickFeatured(entries, 1).map((entry) => entry.data.slug)).toEqual(['c'])
  })

  it('没有精选时返回空数组，不用最新条目顶替', () => {
    const none = entries.map((entry) => ({ data: { ...entry.data, featured: false } }))
    expect(pickFeatured(none, 3)).toEqual([])
  })

  it('limit 为 0 时不返回任何条目', () => {
    expect(pickFeatured(entries, 0)).toEqual([])
  })
})
