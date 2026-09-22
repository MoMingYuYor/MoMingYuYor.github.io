/**
 * 站点身份、导航、联系入口与首屏素材的唯一来源（规格第 8 节：单一站点配置）。
 * 页面与组件只消费本模块，不各自硬编码品牌名、导航项或联系地址。
 *
 * 内容边界：真实姓名、简历、经历与自述的公开范围需本人确认后才写入；
 * 本文件当前只包含已核验的联系入口与关注方向，不包含任何未经确认的个人资料。
 */

import type { HeroAssetPair } from './media'

export type SiteMode = 'preview' | 'release'

export interface NavItem {
  /** 路由段；首页为空数组 */
  readonly segments: readonly string[]
  readonly label: string
}

export type ContactIcon = 'github' | 'mail'

export interface ContactEntry {
  readonly label: string
  readonly href: string
  readonly icon: ContactIcon
  /** 外链渲染时需要 target 与 rel；站内协议（如 mailto）不需要 */
  readonly external: boolean
}

export interface SeoConfig {
  readonly title: string
  readonly description: string
  readonly locale: string
  /** 站点品牌分享图；来源与授权未定，暂为 null，只留配置位不生成图片 */
  readonly shareImage: string | null
}

export interface Identity {
  /** 站点品牌，固定不随主题改变（规格第 3、11.4 节） */
  readonly brand: string
  /** 关注与求职方向；不推导任职经历、职级或工作年限（规格第 3 节） */
  readonly direction: string
  /** 首屏支持文案：只表达关注方向，不承诺能力或成果；本人自述到位后替换 */
  readonly tagline: string
}

/** 目标地址基线：沿用已存在的 GitHub Pages 域名，不更换托管、不改访问范围（规格第 16 节） */
export const siteOrigin = 'https://momingyuyor.github.io'

/**
 * 运行模式。只有两个字面量：`preview`（默认）与 `release`（正式发布）。
 * 未设置或取值非法时按 `preview` 处理——不确定时选择更保守的一侧。
 */
const rawSiteMode = import.meta.env.SITE_MODE
export const siteMode: SiteMode = rawSiteMode === 'release' ? 'release' : 'preview'

/**
 * 索引限制。预览模式恒为 noindex；正式发布模式下的索引开放是**独立的发布状态**
 * （规格第 12 节），由第四阶段 S4-T12 收敛开关，本阶段一律输出 noindex。
 * 索引标记不承担访问控制职责。
 */
export const robotsDirective = 'noindex, nofollow'

export const identity: Identity = {
  brand: 'MoMingYu',
  direction: 'AI 全栈开发 · Agent 开发',
  tagline: '关注 AI 应用与 Agent 工作流的开发实践。',
}

export const seo: SeoConfig = {
  title: 'MoMingYu · AI 全栈开发',
  description: 'MoMingYu 的个人主页：AI 全栈开发与 Agent 开发方向的作品、电脑 DIY 与超频实践，以及技术文章。',
  locale: 'zh-CN',
  shareImage: null,
}

/** 主导航固定五项，顺序固定（规格第 2 节） */
export const navigation: readonly NavItem[] = [
  { segments: [], label: '首页' },
  { segments: ['projects'], label: '作品' },
  { segments: ['hardware'], label: '硬件' },
  { segments: ['blog'], label: '博客' },
  { segments: ['about'], label: '关于' },
]

/**
 * 联系入口。沿用既有站点已核验的 GitHub 与邮箱，不新增电话、住址、
 * 求职城市、薪资或可入职时间（规格第 3 节）。
 */
export const contacts: readonly ContactEntry[] = [
  {
    label: 'GitHub',
    href: 'https://github.com/MoMingYuYor',
    icon: 'github',
    external: true,
  },
  {
    label: '邮箱',
    href: 'mailto:MoMingYu0610@gmail.com',
    icon: 'mail',
    external: false,
  },
]

/**
 * 首屏山湖主视觉（规格第 11.1 节）：浅色用 hero-light，深色用 hero-dark。
 * `alt` 刻意留空——它是装饰性背景，页面身份由 H1 承载，读屏不应重复播报。
 * 素材来源与授权核验独立于视觉批准，不宣称本人拍摄。
 */
export const hero: HeroAssetPair = {
  light: {
    src: 'images/hero-light.webp',
    alt: '',
    width: 1600,
    height: 900,
    kind: 'photo',
    desktopPosition: '50% 50%',
    mobilePosition: '60% 50%',
  },
  dark: {
    src: 'images/hero-dark.webp',
    alt: '',
    width: 1600,
    height: 900,
    kind: 'photo',
    desktopPosition: '50% 50%',
    mobilePosition: '60% 50%',
  },
}
