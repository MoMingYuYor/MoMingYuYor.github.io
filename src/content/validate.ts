import type { GalleryItem, ImageAsset, ProjectItem, SiteContent } from '../types/content'
import { isSafeAssetPath } from '../lib/assets'

/** 单条校验问题：path 定位到字段，message 面向编辑者 */
export interface ContentIssue {
  path: string
  message: string
}

const IMAGE_KINDS = ['photo', 'screenshot'] as const
const CONTACT_ICONS = ['github', 'mail', 'music', 'link'] as const

function push(issues: ContentIssue[], path: string, message: string): void {
  issues.push({ path, message })
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** 发布/源码链接：仅接受 https 或站内相对地址；空格与 # 均无效 */
function isLegalLink(href: string): boolean {
  if (/\s/.test(href) || href.includes('#') || href.startsWith('//')) return false
  return href.startsWith('https://') || href.startsWith('/')
}

/** 联系地址在链接规则之上额外接受 mailto:；空格与 # 均无效 */
function isLegalContactHref(href: string): boolean {
  if (href.startsWith('mailto:')) {
    return href.length > 'mailto:'.length && !/\s/.test(href) && !href.includes('#')
  }
  return isLegalLink(href)
}

function validateImage(
  issues: ContentIssue[],
  asset: ImageAsset,
  path: string,
  options: { decorative: boolean },
): void {
  if (!asset || typeof asset !== 'object') {
    push(issues, path, '图片配置缺失')
    return
  }
  if (!isNonEmptyString(asset.src) || !isSafeAssetPath(asset.src)) {
    push(issues, `${path}.src`, '图片地址必须是站点资源键或 https 地址')
  }
  if (!IMAGE_KINDS.includes(asset.kind)) {
    push(issues, `${path}.kind`, 'kind 必须是 photo 或 screenshot')
  }
  if (!isPositiveInt(asset.width)) {
    push(issues, `${path}.width`, 'width 必须是正整数')
  }
  if (!isPositiveInt(asset.height)) {
    push(issues, `${path}.height`, 'height 必须是正整数')
  }
  // 首屏壁纸是装饰图，alt 必须为空字符串，由页面文字承担朗读；
  // 有信息的内容图必须有非空替代文本。
  if (options.decorative && asset.alt !== '') {
    push(issues, `${path}.alt`, '装饰性壁纸的 alt 必须是空字符串')
  }
  if (!options.decorative && !isNonEmptyString(asset.alt)) {
    push(issues, `${path}.alt`, '信息图片的替代文本不能为空')
  }
  if (asset.mobileSrc !== undefined && (!isNonEmptyString(asset.mobileSrc) || !isSafeAssetPath(asset.mobileSrc))) {
    push(issues, `${path}.mobileSrc`, '移动端图片地址必须是站点资源键或 https 地址')
  }
  if (asset.candidates !== undefined) {
    if (!Array.isArray(asset.candidates)) {
      push(issues, `${path}.candidates`, 'candidates 必须是数组')
    } else {
      asset.candidates.forEach((candidate, index) => {
        if (!isNonEmptyString(candidate.src) || !isSafeAssetPath(candidate.src)) {
          push(issues, `${path}.candidates[${index}].src`, '候选源地址必须是站点资源键或 https 地址')
        }
        if (!isPositiveInt(candidate.width)) {
          push(issues, `${path}.candidates[${index}].width`, '候选源 width 必须是正整数')
        }
      })
    }
  }
}

function validateGalleryItem(
  issues: ContentIssue[],
  item: GalleryItem,
  path: string,
  usedIds: Set<string>,
): void {
  if (!isNonEmptyString(item.id)) {
    push(issues, `${path}.id`, '条目 id 不能为空')
  } else if (usedIds.has(item.id)) {
    push(issues, `${path}.id`, `条目 id 在所在画廊中必须唯一：${item.id}`)
  } else {
    usedIds.add(item.id)
  }
  if (!isNonEmptyString(item.title)) {
    push(issues, `${path}.title`, '条目标题不能为空')
  }
  if (!isNonEmptyString(item.summary)) {
    push(issues, `${path}.summary`, '条目简介不能为空')
  }
  validateImage(issues, item.image, `${path}.image`, { decorative: false })
  if (item.publishedUrl !== undefined && !isLegalLink(item.publishedUrl)) {
    push(issues, `${path}.publishedUrl`, '发布链接必须是 https 或站内相对地址，且不含空格或 #')
  }
  if (item.sourceUrl !== undefined && !isLegalLink(item.sourceUrl)) {
    push(issues, `${path}.sourceUrl`, '源码链接必须是 https 或站内相对地址，且不含空格或 #')
  }
}

/**
 * 内容校验关口：无 DOM、无网络、无存储副作用的纯函数。
 * 构建前检查脚本在问题非空时退出失败，阻止明显缺漏进入发布构建。
 */
export function validateSiteContent(content: SiteContent): ContentIssue[] {
  const issues: ContentIssue[] = []

  if (content.status !== 'demo' && content.status !== 'ready') {
    push(issues, 'status', "status 必须是 'demo' 或 'ready'")
  }
  // demo + 开放索引的组合直接报错；只有 ready 且 allowIndex 才允许索引
  if (content.status === 'demo' && content.seo.allowIndex) {
    push(issues, 'seo.allowIndex', "演示状态（status: 'demo'）不允许开放索引")
  }
  if (!isNonEmptyString(content.seo.title)) {
    push(issues, 'seo.title', 'SEO 标题不能为空')
  }
  if (!isNonEmptyString(content.seo.description)) {
    push(issues, 'seo.description', 'SEO 描述不能为空')
  }
  if (content.seo.locale !== 'zh-CN') {
    push(issues, 'seo.locale', "locale 当前仅支持 'zh-CN'")
  }
  if (content.seo.canonicalUrl !== undefined && !/^https:\/\/\S+$/.test(content.seo.canonicalUrl)) {
    push(issues, 'seo.canonicalUrl', 'canonicalUrl 若存在必须是最终站点的 HTTPS 地址')
  }
  if (content.seo.shareImage) {
    validateImage(issues, content.seo.shareImage, 'seo.shareImage', { decorative: false })
  }

  if (!isNonEmptyString(content.identity.displayName)) {
    push(issues, 'identity.displayName', '显示名称不能为空')
  }
  if (content.identity.eyebrow !== undefined && !isNonEmptyString(content.identity.eyebrow)) {
    push(issues, 'identity.eyebrow', '身份标识若提供则不能为空')
  }
  if (content.identity.legalName !== undefined && !isNonEmptyString(content.identity.legalName)) {
    push(issues, 'identity.legalName', '真实姓名若提供则不能为空')
  }
  if (!isNonEmptyString(content.identity.headline)) {
    push(issues, 'identity.headline', '首屏短句不能为空')
  }
  if (!isNonEmptyString(content.identity.introduction)) {
    push(issues, 'identity.introduction', '个人介绍不能为空')
  }
  if (content.identity.avatar) {
    validateImage(issues, content.identity.avatar, 'identity.avatar', { decorative: false })
  }

  validateImage(issues, content.hero.dark, 'hero.dark', { decorative: true })
  validateImage(issues, content.hero.light, 'hero.light', { decorative: true })
  if (content.hero.wish !== undefined && !isNonEmptyString(content.hero.wish)) {
    push(issues, 'hero.wish', '面板祝愿句若提供则不能为空')
  }
  if (content.hero.quote !== undefined && !isNonEmptyString(content.hero.quote)) {
    push(issues, 'hero.quote', '面板引文若提供则不能为空')
  }
  if (content.hero.footnote !== undefined && !isNonEmptyString(content.hero.footnote)) {
    push(issues, 'hero.footnote', '首屏标语若提供则不能为空')
  }

  const galleryCopies = [
    ['galleries.interests', content.galleries.interests],
    ['galleries.projects', content.galleries.projects],
  ] as const
  for (const [path, copy] of galleryCopies) {
    if (!copy || typeof copy !== 'object') {
      push(issues, path, '画廊章节文案缺失')
      continue
    }
    if (!isNonEmptyString(copy.heading)) {
      push(issues, `${path}.heading`, '章节标题不能为空')
    }
    if (!isNonEmptyString(copy.intro)) {
      push(issues, `${path}.intro`, '章节导语不能为空')
    }
    if (copy.aside !== undefined && !isNonEmptyString(copy.aside)) {
      push(issues, `${path}.aside`, '侧栏引文若提供则不能为空')
    }
  }

  const usedInterestIds = new Set<string>()
  content.interests.forEach((item, index) => {
    validateGalleryItem(issues, item, `interests[${index}]`, usedInterestIds)
  })
  const usedProjectIds = new Set<string>()
  content.projects.forEach((item, index) => {
    validateGalleryItem(issues, item, `projects[${index}]`, usedProjectIds)
    const project = item as ProjectItem
    if (!isNonEmptyString(project.role)) {
      push(issues, `projects[${index}].role`, '项目角色不能为空')
    }
    if (!isNonEmptyString(project.period)) {
      push(issues, `projects[${index}].period`, '项目时间不能为空')
    }
    if (!isNonEmptyString(project.background)) {
      push(issues, `projects[${index}].background`, '项目背景不能为空')
    }
    if (!isNonEmptyString(project.outcome)) {
      push(issues, `projects[${index}].outcome`, '项目成果不能为空')
    }
  })

  if (!isNonEmptyString(content.about.heading)) {
    push(issues, 'about.heading', '关于章节标题不能为空')
  }
  if (!Array.isArray(content.about.paragraphs) || !content.about.paragraphs.some(isNonEmptyString)) {
    push(issues, 'about.paragraphs', '关于章节至少需要一段非空介绍')
  }
  if (content.about.photo) {
    validateImage(issues, content.about.photo, 'about.photo', { decorative: false })
  }

  content.contacts.forEach((contact, index) => {
    if (!isNonEmptyString(contact.label)) {
      push(issues, `contacts[${index}].label`, '联系入口名称不能为空')
    }
    if (!isNonEmptyString(contact.href) || !isLegalContactHref(contact.href)) {
      push(issues, `contacts[${index}].href`, '联系地址必须是 https、mailto: 或站内相对地址，且不含空格或 #')
    }
    if (contact.icon !== undefined && !CONTACT_ICONS.includes(contact.icon)) {
      push(issues, `contacts[${index}].icon`, 'icon 必须是 github、mail、music 或 link')
    }
  })

  if (content.audio) {
    if (!isNonEmptyString(content.audio.title)) {
      push(issues, 'audio.title', '音频标题不能为空')
    }
    if (!isNonEmptyString(content.audio.src) || !isSafeAssetPath(content.audio.src)) {
      push(issues, 'audio.src', '音频地址必须是站点资源键或 https 地址')
    }
  }

  return issues
}
