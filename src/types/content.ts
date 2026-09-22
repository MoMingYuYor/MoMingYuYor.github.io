/** 主题有效值：页面实际呈现的两种外观 */
export type Theme = 'light' | 'dark'
/** 用户偏好：跟随系统或手动指定 */
export type ThemePreference = 'system' | Theme

/** 单个图片资源的字段契约；src 为站点资源键或 https 地址 */
export interface ImageAsset {
  src: string
  alt: string
  width: number
  height: number
  kind: 'photo' | 'screenshot'
  /** 窄屏专用图；缺省时使用同主题主图 */
  mobileSrc?: string
  /** 桌面/移动端各自的裁切焦点（object-position） */
  desktopPosition?: string
  mobilePosition?: string
  /** 响应式候选源，结合 sizes 生成 srcset */
  candidates?: { src: string; width: number }[]
  sizes?: string
}

/** 画廊条目：兴趣与项目共用的最小形状 */
export interface GalleryItem {
  id: string
  title: string
  summary: string
  image: ImageAsset
  publishedUrl?: string
  sourceUrl?: string
}

/** 项目条目在画廊条目之上补充履历事实 */
export interface ProjectItem extends GalleryItem {
  role: string
  period: string
  background: string
  outcome: string
}

export interface ContactLink {
  label: string
  href: string
  /** 社交入口图标标识；缺省时渲染通用链接图标 */
  icon?: 'github' | 'mail' | 'music' | 'link'
}

/** 画廊章节文案：导航与章节头共用一个标题来源 */
export interface GallerySectionCopy {
  heading: string
  intro: string
  /** 侧栏底部的装饰性引文 */
  aside?: string
}

/** 站点内容的单一来源；status: 'demo' 表示全部为演示占位 */
export interface SiteContent {
  status: 'demo' | 'ready'
  identity: {
    displayName: string
    /** 姓名上方的小型身份标识（如 PERSONAL SPACE） */
    eyebrow?: string
    /** 对外 id 之外的真实姓名（如需展示），以小字呈现 */
    legalName?: string
    headline: string
    introduction: string
    avatar?: ImageAsset
  }
  seo: {
    title: string
    description: string
    locale: 'zh-CN'
    canonicalUrl?: string
    shareImage?: ImageAsset
    allowIndex: boolean
  }
  hero: {
    dark: ImageAsset
    light: ImageAsset
    /** 日期面板中问候语后的祝愿句 */
    wish?: string
    /** 日期面板底部的引文 */
    quote?: string
    /** 首屏左下角的装饰性英文标语 */
    footnote?: string
  }
  galleries: {
    interests: GallerySectionCopy
    projects: GallerySectionCopy
  }
  interests: GalleryItem[]
  projects: ProjectItem[]
  about: { heading: string; paragraphs: string[]; photo?: ImageAsset }
  contacts: ContactLink[]
  audio?: { src: string; title: string }
}
