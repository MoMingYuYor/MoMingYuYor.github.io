import { describe, expect, it } from 'vitest'

import { decidePublication, filterResolvableRefs, selectPublished } from '../../src/lib/publication'

const now = new Date('2026-09-22T12:00:00Z')

function entry(slug: string, status: 'draft' | 'published', publishedAt?: string) {
  return {
    id: slug,
    data: {
      slug,
      publicationStatus: status,
      ...(publishedAt ? { publishedAt: new Date(publishedAt) } : {}),
    },
  }
}

describe('decidePublication', () => {
  it('草稿一律不公开并说明原因', () => {
    expect(decidePublication({ publicationStatus: 'draft', publishedAt: new Date('2020-01-01') }, now)).toEqual({
      published: false,
      reason: 'draft',
    })
  })

  it('published 但缺发布日期时不公开', () => {
    expect(decidePublication({ publicationStatus: 'published' }, now)).toEqual({
      published: false,
      reason: 'missing-published-at',
    })
  })

  it('发布日期在未来时不公开', () => {
    expect(
      decidePublication({ publicationStatus: 'published', publishedAt: new Date('2026-09-23T00:00:00Z') }, now),
    ).toEqual({ published: false, reason: 'future-published-at' })
  })

  it('按 UTC 日比较：发布日期当天任意时刻都算已发布', () => {
    // 构建时钟在当日 12:00，发布日期写成当日 23:59 仍应视为已到发布时间
    expect(
      decidePublication({ publicationStatus: 'published', publishedAt: new Date('2026-09-22T23:59:00Z') }, now)
        .published,
    ).toBe(true)
    // 前一天的任意时刻当然也通过
    expect(
      decidePublication({ publicationStatus: 'published', publishedAt: new Date('2026-09-21T00:01:00Z') }, now)
        .published,
    ).toBe(true)
  })
})

describe('selectPublished', () => {
  it('只保留可公开条目并保持输入顺序', () => {
    const input = [
      entry('a', 'published', '2026-09-01'),
      entry('b', 'draft', '2026-09-02'),
      entry('c', 'published', '2026-09-03'),
    ]
    expect(selectPublished(input, now).map((item) => item.data.slug)).toEqual(['a', 'c'])
  })

  it('slug 重复时只保留第一条，避免同一地址生成两份内容', () => {
    const input = [entry('dup', 'published', '2026-09-01'), entry('dup', 'published', '2026-09-02')]
    const result = selectPublished(input, now)
    expect(result).toHaveLength(1)
    expect(result[0]!.data.publishedAt?.toISOString()).toContain('2026-09-01')
  })
})

describe('filterResolvableRefs', () => {
  it('丢掉指向不存在条目的引用', () => {
    const index = new Map([['projects', new Set(['known'])]])
    expect(
      filterResolvableRefs(
        [
          { collection: 'projects', slug: 'known' },
          { collection: 'projects', slug: 'missing' },
          { collection: 'posts', slug: 'known' },
        ],
        index,
      ),
    ).toEqual([{ collection: 'projects', slug: 'known' }])
  })
})
