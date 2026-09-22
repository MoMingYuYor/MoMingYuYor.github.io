import type { ImageAsset, Theme } from '../types/content'

/**
 * Hero 选择资源使用的窄屏断点，必须与 composables/useMediaQuery.ts 的
 * QUERY_NARROW 保持一致（tests/unit/hero-source.test.ts 有相等性守卫）。
 * 单独定义是为了让浏览器引导脚本复用选择规则时不引入 Vue。
 */
export const HERO_NARROW_QUERY = '(max-width: 640px)'

/** 资源选择所需的最小字段：完整 ImageAsset 与 manifest 条目均满足 */
export interface SelectableHeroAsset {
  src: string
  mobileSrc?: string
}

/** 首屏两主题资源的最小形状（site.hero 的资源部分，用于构建 manifest） */
export interface HeroAssetPair {
  light: ImageAsset
  dark: ImageAsset
}

/** selectHeroAsset 的输出：完整资源（供 picture 渲染）+ 按断点选定的资源键 */
export interface SelectedHeroAsset<T extends SelectableHeroAsset = SelectableHeroAsset> {
  theme: Theme
  asset: T
  /** 选定资源键：本地资源键或远程 https 地址，交由 assetUrl/joinAssetKey 解析 */
  key: string
}

/**
 * Hero 与引导脚本共用的资源选择规则：小于 640px 用 mobileSrc，缺省用 src。
 * 两侧必须同断点同选择，预载与实际请求才能命中同一地址；
 * "只下载一张"的验收仅针对未主动切换主题的首次加载。
 * 泛型保证传入完整 ImageAsset 时返回值仍携带渲染所需的全部字段。
 */
export function selectHeroAsset<T extends SelectableHeroAsset>(
  hero: { light: T; dark: T },
  theme: Theme,
  narrow: boolean,
): SelectedHeroAsset<T> {
  const asset = hero[theme]
  return { theme, asset, key: narrow && asset.mobileSrc ? asset.mobileSrc : asset.src }
}

/** 构建时注入引导脚本的 manifest 单主题条目：仅首屏图、移动图与候选资源，不含个人数据 */
export interface HeroManifestEntry {
  src: string
  mobileSrc?: string
  candidates?: { src: string; width: number }[]
  sizes?: string
}

/** 构建时注入引导脚本的 manifest：部署 base + 两主题首屏资源键 */
export interface ThemeBootstrapManifest {
  base: string
  hero: { light: HeroManifestEntry; dark: HeroManifestEntry }
}

/** 从 ImageAsset 抽取 manifest 所需字段，最小化注入数据（不含 alt、尺寸与文案） */
export function toManifestEntry(asset: ImageAsset): HeroManifestEntry {
  const entry: HeroManifestEntry = { src: asset.src }
  if (asset.mobileSrc !== undefined) entry.mobileSrc = asset.mobileSrc
  if (asset.candidates !== undefined) {
    entry.candidates = asset.candidates.map((candidate) => ({ src: candidate.src, width: candidate.width }))
  }
  if (asset.sizes !== undefined) entry.sizes = asset.sizes
  return entry
}

/** 构建时生成 manifest：base 来自 vite config，资源键来自内容源 site.hero */
export function buildThemeManifest(hero: HeroAssetPair, base: string): ThemeBootstrapManifest {
  return {
    base,
    hero: { light: toManifestEntry(hero.light), dark: toManifestEntry(hero.dark) },
  }
}
