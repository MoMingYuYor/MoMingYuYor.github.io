import { describe, expect, it } from 'vitest'

import {
  EDITORIAL_PHRASES,
  findEditorialPhrase,
  hasBlockingIssue,
  isMissingMeasurement,
  isPlaceholderAsset,
  validateCollections,
  validateUnit,
  type ContentIssue,
} from '../../src/content/validate'
import type { CollectionSnapshot } from '../../src/content/snapshot'
import { emptySnapshot } from '../../src/content/snapshot'

const now = new Date('2026-09-22T00:00:00Z')

function snapshotWith(entry: Partial<Record<string, unknown>>): CollectionSnapshot {
  const base = emptySnapshot()
  return {
    ...base,
    projects: [
      {
        collection: 'projects',
        id: 'demo',
        filePath: 'src/content/projects/demo.md',
        body: '正文。',
        data: {
          slug: 'demo',
          title: '示例项目',
          summary: '摘要。',
          publicationStatus: 'draft',
          featured: false,
          techTags: [],
          screenshots: [],
          evidence: [],
          links: [],
          relatedProjects: [],
          relatedPosts: [],
          relatedBuilds: [],
          relatedOverclocking: [],
          ...entry,
        },
      },
    ],
  }
}

function validate(snapshot: CollectionSnapshot, mode: 'preview' | 'release' = 'preview') {
  return validateCollections(snapshot, {
    now,
    mode,
    resolveLocalFile: () => 'file',
  })
}

describe('发布前提', () => {
  it('published 缺 publishedAt 阻断', () => {
    const issues = validate(snapshotWith({ publicationStatus: 'published' }))
    expect(issues.some((issue) => issue.message.includes('缺少 publishedAt'))).toBe(true)
  })

  it('updatedAt 早于 publishedAt 阻断', () => {
    const issues = validate(
      snapshotWith({
        publicationStatus: 'published',
        publishedAt: new Date('2026-09-10'),
        updatedAt: new Date('2026-09-01'),
      }),
    )
    expect(issues.some((issue) => issue.message.includes('updatedAt 早于 publishedAt'))).toBe(true)
  })

  it('日期正常时不报问题', () => {
    expect(
      validate(
        snapshotWith({
          publicationStatus: 'published',
          publishedAt: new Date('2026-09-10'),
          updatedAt: new Date('2026-09-12'),
        }),
      ),
    ).toEqual([])
  })
})

describe('slug 唯一性', () => {
  it('同集合内重复 slug 阻断并指出冲突来源', () => {
    const base = snapshotWith({})
    const snapshot: CollectionSnapshot = {
      ...base,
      projects: [
        base.projects[0]!,
        { ...base.projects[0]!, id: 'demo2', filePath: 'src/content/projects/demo-2.md' },
      ],
    }
    const issues = validate(snapshot)
    const issue = issues.find((item) => item.message.includes('重复'))
    expect(issue?.severity).toBe('blocking')
    expect(issue?.message).toContain('demo')
  })
})

describe('引用完整性', () => {
  it('引用不存在的条目阻断', () => {
    const issues = validate(snapshotWith({ relatedProjects: ['not-there'] }))
    expect(issues.some((issue) => issue.message.includes('引用不存在的条目'))).toBe(true)
  })

  it('引用存在的条目通过', () => {
    const issues = validate(snapshotWith({ relatedProjects: ['demo'] }))
    expect(issues).toEqual([])
  })
})

describe('链接合法性', () => {
  it('非法外链阻断', () => {
    const issues = validate(snapshotWith({ sourceUrl: 'javascript:alert(1)' }))
    expect(issues.some((issue) => issue.message.includes('非法链接'))).toBe(true)
  })

  it('links 与 evidence 里的链接同样受检', () => {
    const issues = validate(
      snapshotWith({
        links: [{ label: '源码', href: '//evil.example' }],
        evidence: [{ label: '检查记录', href: '/../etc/passwd' }],
      }),
    )
    expect(issues.filter((issue) => issue.message.includes('非法链接'))).toHaveLength(2)
  })
})

describe('媒体与替代文本', () => {
  it('截图缺替代文本阻断', () => {
    const issues = validate(
      snapshotWith({
        screenshots: [{ src: 'images/real.webp', alt: '', width: 1600, height: 900, kind: 'screenshot' }],
      }),
    )
    expect(issues.some((issue) => issue.message.includes('截图必须提供替代文本'))).toBe(true)
  })

  it('装饰性摄影素材允许空替代文本', () => {
    const issues = validate(
      snapshotWith({
        screenshots: [{ src: 'images/real.webp', alt: '', width: 1600, height: 900, kind: 'photo' }],
      }),
    )
    expect(issues).toEqual([])
  })

  it('本地文件缺失或越界阻断', () => {
    const missing = validateCollections(snapshotWith({ cover: { src: 'images/none.webp', alt: 'x', width: 1, height: 1, kind: 'photo' } }), {
      now,
      mode: 'preview',
      resolveLocalFile: () => 'missing',
    })
    expect(missing.some((issue) => issue.message.includes('本地文件不存在'))).toBe(true)

    const unsafe = validateCollections(snapshotWith({ cover: { src: 'images/none.webp', alt: 'x', width: 1, height: 1, kind: 'photo' } }), {
      now,
      mode: 'preview',
      resolveLocalFile: () => 'unsafe',
    })
    expect(unsafe.some((issue) => issue.message.includes('越界'))).toBe(true)
  })
})

describe('占位素材与编辑说明', () => {
  it('识别占位文件名', () => {
    expect(isPlaceholderAsset('images/placeholder-shot-1.svg')).toBe(true)
    expect(isPlaceholderAsset('images/hero-light.webp')).toBe(false)
  })

  it('preview 记警告，release 记阻断（规格第 8 节）', () => {
    const snapshot = snapshotWith({
      cover: { src: 'images/placeholder-shot-1.svg', alt: 'x', width: 1, height: 1, kind: 'screenshot' },
    })
    const preview = validate(snapshot, 'preview').filter((issue) => issue.message.includes('占位素材'))
    const release = validate(snapshot, 'release').filter((issue) => issue.message.includes('占位素材'))
    expect(preview[0]?.severity).toBe('warning')
    expect(release[0]?.severity).toBe('blocking')
  })

  it('编辑说明措辞在 preview 是警告、release 是阻断', () => {
    const preview = validate(snapshotWith({ summary: '此处用于展示' }), 'preview')
    const release = validate(snapshotWith({ summary: '此处用于展示' }), 'release')
    expect(preview.every((issue) => issue.severity === 'warning')).toBe(true)
    expect(release.some((issue) => issue.severity === 'blocking')).toBe(true)
    expect(EDITORIAL_PHRASES.length).toBeGreaterThan(0)
    expect(findEditorialPhrase('正文待整理：xxx')).toBe('待整理')
  })
})

describe('单位与缺失值基元', () => {
  it('带单位数值缺少单位时阻断', () => {
    const issues: ContentIssue[] = []
    validateUnit({ value: 5.2, unit: undefined }, 'oc: 频率', issues)
    expect(issues[0]?.severity).toBe('blocking')
  })

  it('缺失值不参与校验，也不会被判成 0', () => {
    const issues: ContentIssue[] = []
    validateUnit({ value: undefined, unit: undefined }, 'oc: 频率', issues)
    expect(issues).toEqual([])
    expect(isMissingMeasurement(undefined)).toBe(true)
    expect(isMissingMeasurement(null)).toBe(true)
    expect(isMissingMeasurement('')).toBe(true)
    expect(isMissingMeasurement(0)).toBe(false)
  })
})

describe('hasBlockingIssue', () => {
  it('只有警告时不算阻断', () => {
    expect(hasBlockingIssue([{ path: 'a', message: 'b', severity: 'warning' }])).toBe(false)
    expect(hasBlockingIssue([{ path: 'a', message: 'b', severity: 'blocking' }])).toBe(true)
  })
})
