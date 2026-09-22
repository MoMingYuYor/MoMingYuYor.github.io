const REMOTE_HTTPS = /^https:\/\//

/**
 * 资源路径合法性：内部素材使用不含前导斜杠的资源键，
 * 远程仅接受 https；拒绝协议相对地址、其他协议与 '..' 目录穿越。
 */
export function isSafeAssetPath(path: string): boolean {
  if (!path) return false
  if (path.startsWith('//')) return false
  if (REMOTE_HTTPS.test(path)) return true
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false
  if (path.startsWith('/')) return false
  if (path.includes('..')) return false
  return true
}

/** 结合部署 base 生成最终地址；GitHub Pages 等子路径部署不能硬编码 /images */
export function joinAssetKey(base: string, path: string): string {
  if (!isSafeAssetPath(path)) {
    throw new Error(`不安全的资源路径：${path}`)
  }
  if (REMOTE_HTTPS.test(path)) return path
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return encodeURI(normalizedBase + path)
}

/** 组件内使用的便捷封装；纯逻辑在 joinAssetKey，便于单测 */
export function assetUrl(path: string): string {
  return joinAssetKey(import.meta.env.BASE_URL, path)
}
