/**
 * 媒体资源描述与派生规则。预载、`<picture>`、`srcset`、`sizes`、裁切焦点与
 * 缩略图来源全部从同一份描述派生，使浏览器实际下载的文件与预载选中的文件一致，
 * 避免出现「预载与实际显示选到不同文件」的重复请求。
 */

import { assetPath } from './paths'
import type { Theme } from './theme'

export type MediaKind = 'photo' | 'screenshot'

/** 响应式候选图：同一素材的不同宽度版本 */
export interface MediaCandidate {
  readonly src: string
  readonly width: number
}

/**
 * 媒体资源描述。`kind` 区分摄影素材与产品截图：截图默认完整显示不裁切，
 * 摄影素材可按明确焦点裁切（规格第 9 节）。
 */
export interface MediaAsset {
  readonly src: string
  /** 装饰性图片用空字符串；内容图片必须提供有意义的替代文本 */
  readonly alt: string
  readonly width: number
  readonly height: number
  readonly kind: MediaKind
  /** 未提供时只有 src 一个候选，srcset 与 sizes 都不输出 */
  readonly candidates?: readonly MediaCandidate[]
  /** 与 srcset 配套；没有候选图时无意义 */
  readonly sizes?: string
  /** 宽视口裁切焦点（object-position） */
  readonly desktopPosition?: string
  /** 窄视口裁切焦点 */
  readonly mobilePosition?: string
}

export interface ImgAttributes {
  readonly src: string
  readonly alt: string
  readonly width: number
  readonly height: number
  readonly srcset?: string
  readonly sizes?: string
  readonly loading: 'lazy' | 'eager'
  readonly decoding: 'async' | 'sync'
  readonly fetchpriority?: 'high' | 'auto'
}

export interface PreloadLinkAttributes {
  readonly rel: 'preload'
  readonly as: 'image'
  readonly href: string
  readonly imagesrcset?: string
  readonly imagesizes?: string
  readonly fetchpriority: 'high'
}

export function srcsetOf(asset: MediaAsset, base: string): string | undefined {
  if (!asset.candidates || asset.candidates.length === 0) return undefined
  return asset.candidates
    .map((candidate) => `${assetPath(base, candidate.src)} ${candidate.width}w`)
    .join(', ')
}

export function sizesOf(asset: MediaAsset): string | undefined {
  return asset.candidates && asset.candidates.length > 0 ? asset.sizes : undefined
}

/** 裁切焦点：窄视口优先用 mobilePosition，缺失时退回 desktopPosition */
export function objectPositionOf(asset: MediaAsset, narrow: boolean): string | undefined {
  return narrow ? (asset.mobilePosition ?? asset.desktopPosition) : asset.desktopPosition
}

/**
 * 缩略图来源：候选图存在时取最小宽度的那张，绝不让高分辨率原图充当缩略图。
 * 没有候选图时只能用 src——此时唯一的资源就是原图，调用点需自行确认尺寸可接受。
 */
export function thumbnailSourceOf(asset: MediaAsset, base: string): string {
  const candidates = asset.candidates ?? []
  if (candidates.length === 0) return assetPath(base, asset.src)
  const smallest = candidates.reduce((min, candidate) =>
    candidate.width < min.width ? candidate : min,
  )
  return assetPath(base, smallest.src)
}

export function imgAttributes(
  asset: MediaAsset,
  base: string,
  options: { priority?: boolean } = {},
): ImgAttributes {
  const attributes: ImgAttributes = {
    src: assetPath(base, asset.src),
    alt: asset.alt,
    width: asset.width,
    height: asset.height,
    loading: options.priority ? 'eager' : 'lazy',
    decoding: 'async',
  }
  const srcset = srcsetOf(asset, base)
  const sizes = sizesOf(asset)
  return {
    ...attributes,
    ...(srcset ? { srcset } : {}),
    ...(sizes ? { sizes } : {}),
    ...(options.priority ? { fetchpriority: 'high' as const } : {}),
  }
}

/** 预载属性与 `img`/`source` 取自同一描述，两者不会选到不同文件 */
export function preloadLinkOf(asset: MediaAsset, base: string): PreloadLinkAttributes {
  const srcset = srcsetOf(asset, base)
  const sizes = sizesOf(asset)
  return {
    rel: 'preload',
    as: 'image',
    href: assetPath(base, asset.src),
    fetchpriority: 'high',
    ...(srcset ? { imagesrcset: srcset } : {}),
    ...(sizes ? { imagesizes: sizes } : {}),
  }
}

/**
 * 首屏窄视口裁切断点。这是该数值的唯一来源：预载与 `<source>` 的 media 都用它。
 * 旧实现里 CSS 与 JS 各写一份、靠单测守卫相等，这里收敛为一处。
 */
export const HERO_NARROW_QUERY = '(max-width: 640px)'

export interface HeroAssetPair {
  readonly light: MediaAsset
  readonly dark: MediaAsset
}

/**
 * 首屏选图：主题是唯一输入。窄视口只改变裁切焦点（见 objectPositionOf），
 * 不切换文件——因此当前每个主题只有一个候选，srcset 只有一项。
 */
export function selectHeroAsset(hero: HeroAssetPair, theme: Theme): MediaAsset {
  return theme === 'dark' ? hero.dark : hero.light
}

export interface HeroManifestEntry {
  /** 构建期已解析好的地址（含 base），浏览器端不再做路径拼接 */
  readonly href: string
  readonly width: number
  readonly height: number
}

/**
 * 首帧引导脚本用的最小清单：只含选图与预载必需的字段，且地址在构建期解析完毕，
 * 因此内联脚本不必携带任何路径逻辑。不携带站点文案或内容数据。
 */
export interface ThemeBootstrapManifest {
  readonly hero: Readonly<Record<Theme, HeroManifestEntry>>
}

export function buildThemeManifest(hero: HeroAssetPair, base: string): ThemeBootstrapManifest {
  const toEntry = (asset: MediaAsset): HeroManifestEntry => ({
    href: assetPath(base, asset.src),
    width: asset.width,
    height: asset.height,
  })
  return { hero: { light: toEntry(hero.light), dark: toEntry(hero.dark) } }
}
