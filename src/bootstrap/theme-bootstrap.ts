/**
 * 首帧主题引导入口（浏览器专用，不引入任何框架）。
 * 由 scripts/build-theme-bootstrap.ts 以 IIFE 打包为最小内联脚本注入 `<head>`，
 * 清单（部署 base + 首屏资源键）经虚拟模块在构建时注入。
 *
 * 顺序很重要：先确定主题再预载，保证首帧配色与实际请求的壁纸一致，
 * 避免浅色闪一下再变深色。规则只来自 src/lib/theme.ts，不在这里重写判定。
 * 任何一步失败都安全降级：tokens.css 的 prefers-color-scheme 兜底与无脚本
 * 说明仍然可用，只是少一条预载请求。
 */

import { readStoredPreference, resolveTheme } from '../lib/theme'
import manifest from 'virtual:theme-bootstrap-manifest'

/** matchMedia 缺失或抛异常时按 false 处理（视为系统浅色） */
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

  const root = document.documentElement
  root.dataset.theme = theme
  root.style.setProperty('color-scheme', theme)

  // 与页面渲染取自同一份描述；地址已在构建期解析，浏览器端不做路径拼接
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = manifest.hero[theme].href
  link.fetchPriority = 'high'
  document.head.appendChild(link)
} catch {
  /* 存储被禁用、matchMedia 异常或清单异常时静默降级，不阻塞页面 */
}
