/**
 * 主题引导入口（浏览器专用，不引入 Vue）。
 * 由 scripts/build-theme-bootstrap.ts 以 IIFE 打包为最小内联脚本注入 index.html，
 * manifest（部署 base + 首屏资源键）经虚拟模块在构建时注入。
 * 与 src/lib/theme.ts、src/lib/hero-source.ts 共用同一套纯规则：
 * 读偏好 → 解析有效主题 → 设置根节点属性 → 为有效主题与当前视口
 * 选定唯一首屏资源并插入一条 preload。
 * 任何一步失败都安全降级：系统主题 CSS（tokens.css 的 prefers-color-scheme 兜底）
 * 与无脚本说明仍可用，仅少一条预载请求。
 */
import { joinAssetKey } from '../lib/assets'
import { HERO_NARROW_QUERY, selectHeroAsset } from '../lib/hero-source'
import type { ThemeBootstrapManifest } from '../lib/hero-source'
import { readStoredPreference, resolveTheme } from '../lib/theme'
import manifest from 'virtual:theme-bootstrap-manifest'

/** matchMedia 缺失或抛异常时按 false 处理（视为宽屏、系统浅色） */
function matches(query: string): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  } catch {
    return false
  }
}

try {
  // readStoredPreference 内部已捕获存储读取异常并回退 'system'
  const preference = readStoredPreference((key) => window.localStorage.getItem(key))
  const theme = resolveTheme(preference, matches('(prefers-color-scheme: dark)'))

  // 先确定主题再预载：保证首帧配色与实际请求的壁纸一致
  document.documentElement.dataset.theme = theme
  document.documentElement.style.setProperty('color-scheme', theme)

  const selected = selectHeroAsset(manifest.hero, theme, matches(HERO_NARROW_QUERY))
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  // 本地资源键经 base 解析（子路径部署安全）；https 地址由 joinAssetKey 原样返回
  link.href = joinAssetKey(manifest.base, selected.key)
  // 若使用候选图，imagesrcset/imagesizes 必须与实际 picture 的表达完全相同
  const entry = manifest.hero[theme]
  if (entry.candidates && entry.sizes) {
    link.setAttribute(
      'imagesrcset',
      entry.candidates
        .map((candidate) => `${joinAssetKey(manifest.base, candidate.src)} ${candidate.width}w`)
        .join(', '),
    )
    link.setAttribute('imagesizes', entry.sizes)
  }
  document.head.appendChild(link)
} catch {
  /* 存储被禁用、matchMedia 异常或 manifest 异常时静默降级，不阻塞页面 */
}
