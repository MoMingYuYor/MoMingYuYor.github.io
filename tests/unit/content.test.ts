// 内容校验单测：对应 src/content/validate.ts 的 validateSiteContent 契约
// fixture 直接取自演示站点 src/content/site.ts，所有修改均基于副本，不污染原始对象
import { describe, expect, it } from 'vitest'
import { site } from '../../src/content/site'
import { validateSiteContent } from '../../src/content/validate'
import type { SiteContent } from '../../src/types/content'

/** validateSiteContent 的返回类型（问题列表） */
type ContentIssues = ReturnType<typeof validateSiteContent>

/** 深拷贝演示站点，保证每个用例基于干净的 fixture */
function cloneSite(): SiteContent {
  return {
    ...site,
    seo: { ...site.seo },
    hero: {
      dark: { ...site.hero.dark },
      light: { ...site.hero.light },
    },
    interests: site.interests.map((item) => ({ ...item, image: { ...item.image } })),
    projects: site.projects.map((item) => ({ ...item, image: { ...item.image } })),
    about: { ...site.about, paragraphs: [...site.about.paragraphs] },
    contacts: site.contacts.map((contact) => ({ ...contact })),
  }
}

/** 断言问题列表中存在指定字段路径的问题，失败时输出完整问题便于定位 */
function expectPath(issues: ContentIssues, path: string): void {
  expect(
    issues.some((issue) => issue.path === path),
    `应存在 path 为 "${path}" 的问题，实际问题列表：${JSON.stringify(issues)}`,
  ).toBe(true)
}

describe('validateSiteContent', () => {
  it('演示站点本身通过校验', () => {
    expect(validateSiteContent(site)).toEqual([])
  })

  it("status 为 'demo' 且允许索引时报 seo.allowIndex 问题", () => {
    const modified = cloneSite()
    modified.seo.allowIndex = true
    expectPath(validateSiteContent(modified), 'seo.allowIndex')
  })

  it('identity.legalName 提供空字符串时定位到 identity.legalName，未提供时不报', () => {
    const empty = cloneSite()
    empty.identity = { ...site.identity, legalName: '  ' }
    expectPath(validateSiteContent(empty), 'identity.legalName')

    const absent = cloneSite()
    absent.identity = { ...site.identity }
    delete absent.identity.legalName
    expect(validateSiteContent(absent)).toEqual([])
  })

  it('interests 出现重复 id 时定位到 interests[N].id', () => {
    const modified = cloneSite()
    // 把第二条的 id 改成与第一条相同，制造画廊内重复
    modified.interests[1] = { ...modified.interests[1], id: modified.interests[0]!.id }
    const issues = validateSiteContent(modified)
    expect(issues.some((issue) => /^interests\[\d+\]\.id$/.test(issue.path))).toBe(true)
  })

  it('interests 条目标题或简介为空时定位到对应字段', () => {
    const modified = cloneSite()
    modified.interests[1] = { ...modified.interests[1], title: '', summary: '' }
    const issues = validateSiteContent(modified)
    expectPath(issues, 'interests[1].title')
    expectPath(issues, 'interests[1].summary')
  })

  it('interests 发布链接协议非法、含空格或 # 时定位到 interests[N].publishedUrl', () => {
    const invalidUrls = ['javascript:alert(1)', 'https://a b.com', 'https://x.com/#frag']
    for (const publishedUrl of invalidUrls) {
      const modified = cloneSite()
      modified.interests[0] = { ...modified.interests[0], publishedUrl }
      expectPath(validateSiteContent(modified), 'interests[0].publishedUrl')
    }
  })

  it('projects 缺少角色/时间/背景/成果时定位到对应字段', () => {
    const modified = cloneSite()
    modified.projects[0] = {
      ...modified.projects[0],
      role: '',
      period: '',
      background: '',
      outcome: '',
    }
    const issues = validateSiteContent(modified)
    expectPath(issues, 'projects[0].role')
    expectPath(issues, 'projects[0].period')
    expectPath(issues, 'projects[0].background')
    expectPath(issues, 'projects[0].outcome')
  })

  it('首屏壁纸 alt 非空时定位到 hero.dark.alt', () => {
    const modified = cloneSite()
    // 首屏壁纸是装饰图，演示站点约定 alt 为空字符串
    modified.hero.dark = { ...modified.hero.dark, alt: '风景' }
    expectPath(validateSiteContent(modified), 'hero.dark.alt')
  })

  it('画廊内容图 alt 为空时定位到 interests[N].image.alt', () => {
    const modified = cloneSite()
    // 有信息的内容图必须有非空替代文本
    modified.interests[1] = {
      ...modified.interests[1],
      image: { ...modified.interests[1].image, alt: '' },
    }
    expectPath(validateSiteContent(modified), 'interests[1].image.alt')
  })

  it('兴趣与项目全部置空后仍通过校验', () => {
    const modified: SiteContent = { ...cloneSite(), interests: [], projects: [] }
    expect(validateSiteContent(modified)).toEqual([])
  })

  it('contacts href 协议非法或含 # 时定位到 contacts[N].href', () => {
    const invalidHrefs = ['http://a.com', 'https://a.com/#contact']
    for (const href of invalidHrefs) {
      const modified = cloneSite()
      modified.contacts = [{ label: '邮箱', href }]
      expectPath(validateSiteContent(modified), 'contacts[0].href')
    }
  })

  it('contacts 接受 mailto: 与 https: 合法链接', () => {
    const modified = cloneSite()
    modified.contacts = [
      { label: '邮箱', href: 'mailto:a@b.com' },
      { label: '主页', href: 'https://a.com' },
    ]
    expect(validateSiteContent(modified)).toEqual([])
  })

  it('mailto 联系地址含 # 或空格时定位到 contacts[N].href', () => {
    for (const href of ['mailto:a#b.com', 'mailto:a b@c.com']) {
      const modified = cloneSite()
      modified.contacts = [{ label: '邮箱', href }]
      expectPath(validateSiteContent(modified), 'contacts[0].href')
    }
  })

  it('canonicalUrl 若存在必须是 https 地址', () => {
    const modified = cloneSite()
    modified.seo.canonicalUrl = 'http://example.com/'
    expectPath(validateSiteContent(modified), 'seo.canonicalUrl')
  })

  it('图片 mobileSrc 与 candidates 的不安全路径定位到对应字段', () => {
    const modified = cloneSite()
    modified.hero.dark = { ...modified.hero.dark, mobileSrc: '../escape.svg' }
    modified.interests[0] = {
      ...modified.interests[0],
      image: {
        ...modified.interests[0].image,
        candidates: [{ src: '/absolute.svg', width: 0 }],
      },
    }
    const issues = validateSiteContent(modified)
    expectPath(issues, 'hero.dark.mobileSrc')
    expectPath(issues, 'interests[0].image.candidates[0].src')
    expectPath(issues, 'interests[0].image.candidates[0].width')
  })
})
