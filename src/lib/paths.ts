/**
 * 站内路径与资源 URL 的唯一构造函数。页面、组件与脚本一律经本模块生成地址，
 * 内容里不散落硬编码前缀；子路径部署（SITE_BASE）只在这里处理一次。
 *
 * 安全边界：路径段与资源引用都做显式校验并抛出，不做字符串前缀式的宽松判断——
 * 反斜杠、前导斜杠、`..`、控制字符与协议相对地址都能绕过朴素的前缀检查。
 */

/** 单个路径段：拒绝空段、相对段、分隔符、查询与片段、控制字符 */
export function isSafeSegment(segment: string): boolean {
  if (segment === '' || segment === '.' || segment === '..') return false
  if (/[/\\?#]/.test(segment)) return false
  if (/[\u0000-\u001f\u007f]/.test(segment)) return false
  return true
}

/**
 * 资源引用：接受站内相对键（如 `images/hero.webp`）与带主机的 https 绝对地址。
 * 拒绝协议相对地址（`//host`）、前导斜杠（会绕过 base）、反斜杠、控制字符、
 * `..` 段，以及没有主机的 `https://` 与带凭据形式的地址。
 *
 * 带协议的地址用 URL 解析器判定，不用字符串前缀——`https://trusted@evil.example/`
 * 这类凭据形式靠前缀判断会被误判为可信来源。
 */
export function isSafeAssetPath(path: string): boolean {
  if (path === '') return false
  if (path.startsWith('//')) return false
  if (path.startsWith('/')) return false
  if (path.includes('\\')) return false
  if (/[\u0000-\u001f\u007f]/.test(path)) return false
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) {
    let parsed: URL
    try {
      parsed = new URL(path)
    } catch {
      return false
    }
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname !== '' &&
      parsed.username === '' &&
      parsed.password === ''
    )
  }
  return !path.split('/').some((segment) => segment === '..')
}

/** 规范化 base：`''`、`'/'`、`'/personal'`、`'/personal/'` 都收敛为以单个斜杠包裹的形式 */
export function normalizeBase(base: string): string {
  const trimmed = base.replace(/^\/+/, '').replace(/\/+$/, '')
  return trimmed === '' ? '/' : `/${trimmed}/`
}

/**
 * 站内页面路径，统一尾斜杠（规格第 2 节）。
 * 不传段时返回 base 本身（首页）。段不合法时抛出，不静默丢弃。
 */
export function sitePath(base: string, ...segments: string[]): string {
  const prefix = normalizeBase(base)
  for (const segment of segments) {
    if (!isSafeSegment(segment)) {
      throw new Error(`不安全的路径段：${JSON.stringify(segment)}`)
    }
  }
  return segments.length === 0 ? prefix : `${prefix}${segments.join('/')}/`
}

/** 资源 URL：https 绝对地址原样返回，站内相对键拼上 base。键不合法时抛出 */
export function assetPath(base: string, path: string): string {
  if (!isSafeAssetPath(path)) {
    throw new Error(`不安全的资源路径：${JSON.stringify(path)}`)
  }
  if (/^https:\/\//i.test(path)) return path
  return `${normalizeBase(base)}${path}`
}

/** 绝对地址（canonical、分享元数据用）。origin 只含协议与主机，不含路径 */
export function absoluteUrl(origin: string, base: string, ...segments: string[]): string {
  return `${origin.replace(/\/+$/, '')}${sitePath(base, ...segments)}`
}
