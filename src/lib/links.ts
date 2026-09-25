/**
 * 外链与站内路径的统一判定（规格第 12 节）。
 *
 * 用 URL 解析器而不是字符串前缀：`https://trusted.example@evil.example/` 这类凭据形式、
 * `https://`（无主机）、反斜杠与控制字符都能绕过朴素的前缀判断。
 * 组件与校验器共用本模块，不再各自写 `startsWith('https://')`。
 */

export type HrefKind = 'internal' | 'external' | 'mailto' | 'invalid'

/**
 * 反斜杠与控制字符一律先拒绝，不做分支判断：URL 解析器会把特殊协议里的 `\` 当作 `/`，
 * 于是 `https://good.example\@evil.example` 会被解析成 `https://good.example/@evil.example`，
 * 主机变成受信任域名而凭据检查被绕过。
 */
const FORBIDDEN = /[\\\u0000-\u001f\u007f]/

/** 邮件地址的宽松但完整形式：本地部分@域名，不含空白与尖括号 */
const MAILTO_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

/**
 * 站内路径：必须以单个 `/` 开头，不得是协议相对地址，
 * 且解析后仍落在预期来源（不出现协议、主机或凭据）。
 */
function isInternalPath(href: string): boolean {
  if (!href.startsWith('/')) return false
  if (href.startsWith('//')) return false
  if (href.includes('\\')) return false
  if (/[\u0000-\u001f\u007f]/.test(href)) return false
  // 在解析器归一化之前先拒绝编码后的父目录段，避免 URL 将 /a/../b 规整后掩盖穿越
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(href.split(/[?#]/, 1)[0] ?? '')
  } catch {
    return false
  }
  if (decodedPath.split('/').some((segment) => segment === '..')) return false
  try {
    const parsed = new URL(href, 'https://internal.invalid')
    return parsed.origin === 'https://internal.invalid'
  } catch {
    return false
  }
}

export function classifyHref(href: string): HrefKind {
  if (href === '') return 'invalid'
  if (FORBIDDEN.test(href)) return 'invalid'

  if (href.startsWith('/')) return isInternalPath(href) ? 'internal' : 'invalid'

  if (/^mailto:/i.test(href)) {
    const address = href.slice('mailto:'.length)
    return MAILTO_PATTERN.test(address) ? 'mailto' : 'invalid'
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) {
    let parsed: URL
    try {
      parsed = new URL(href)
    } catch {
      return 'invalid'
    }
    const cleanHttps =
      parsed.protocol === 'https:' &&
      parsed.hostname !== '' &&
      parsed.username === '' &&
      parsed.password === ''
    return cleanHttps ? 'external' : 'invalid'
  }

  // 不带协议的相对引用：站内锚点可以，其余（相对文件路径）在本站不使用
  return href.startsWith('#') ? 'internal' : 'invalid'
}

export function isSafeHref(href: string): boolean {
  return classifyHref(href) !== 'invalid'
}

export function isExternalHref(href: string): boolean {
  return classifyHref(href) === 'external'
}

/** 外链需要的属性；站内路径与 mailto 都不需要新窗口语义 */
export function externalLinkAttributes(href: string): { target: '_blank'; rel: 'noopener noreferrer' } | undefined {
  return isExternalHref(href) ? { target: '_blank', rel: 'noopener noreferrer' } : undefined
}
