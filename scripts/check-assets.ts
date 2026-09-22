/**
 * 构建侧本地媒体资源检查（技术方案 6.3 / T8）：
 * 遍历站点内容中的全部媒体资源键（身份头像、两种首屏图及移动图、候选图、兴趣、作品、
 * 关于、分享图与可选音频），对每个非 HTTPS 的本地键做三层检查——
 *   1. 规范化路径不越出 public 根（拒绝 '..' 穿越与绝对路径键）；
 *   2. 目标实际存在且是文件（缺图、指向目录均报告）；
 *   3. realpath 复核：符号链接的真实目标同样不得逃离 public 根。
 * 远程 HTTPS 资源不在构建期发网络请求，链接核验保留人工；本检查不替代媒体授权核查。
 *
 * 与 validateSiteContent 的纯结构校验分离：这里是 Node fs 检查，仅在
 * ensureSiteMeta（构建/开发准备关口）中调用，也可被单测以临时目录驱动。
 */
import { realpathSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import type { ContentIssue } from '../src/content/validate'
import type { ImageAsset, SiteContent } from '../src/types/content'

/** 远程资源仅接受 https（与 src/lib/assets.ts 的口径一致） */
const REMOTE_HTTPS = /^https:\/\//

/** target 是否落在 root 目录内部（relative 结果不以 '..' 开头且不是绝对路径） */
function isInsideRoot(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** 收集内容中全部媒体资源引用：[字段路径, src]，可选字段缺省时跳过 */
export function collectAssetRefs(content: SiteContent): [string, string][] {
  const refs: [string, string][] = []
  const addImage = (path: string, asset: ImageAsset | undefined | null): void => {
    if (!asset) return
    refs.push([`${path}.src`, asset.src])
    if (asset.mobileSrc !== undefined) refs.push([`${path}.mobileSrc`, asset.mobileSrc])
    asset.candidates?.forEach((candidate, index) => {
      refs.push([`${path}.candidates[${index}].src`, candidate.src])
    })
  }
  addImage('identity.avatar', content.identity?.avatar)
  addImage('seo.shareImage', content.seo?.shareImage)
  addImage('hero.dark', content.hero?.dark)
  addImage('hero.light', content.hero?.light)
  content.interests?.forEach((item, index) => addImage(`interests[${index}].image`, item?.image))
  content.projects?.forEach((item, index) => addImage(`projects[${index}].image`, item?.image))
  addImage('about.photo', content.about?.photo)
  if (content.audio) refs.push(['audio.src', content.audio.src])
  return refs
}

/**
 * 检查站点内容里的本地媒体资源：返回带字段路径的问题数组，空数组表示通过。
 * publicRoot 为站点 public 目录的绝对路径；目录不存在时在 publicRoot 字段报告。
 */
export function checkLocalAssets(content: SiteContent, publicRoot: string): ContentIssue[] {
  const issues: ContentIssue[] = []
  let realRoot: string
  try {
    realRoot = realpathSync(publicRoot)
  } catch {
    return [{ path: 'publicRoot', message: `public 根目录不存在或不可达：${publicRoot}` }]
  }

  for (const [path, src] of collectAssetRefs(content)) {
    // 远程 HTTPS 不在构建时发网络请求：跳过文件系统检查，链接核验保留人工
    if (REMOTE_HTTPS.test(src)) continue

    // 第一层：规范化路径必须留在 public 根内（绝对键指向根外与 '..' 穿越在此拦截）
    const normalized = resolve(publicRoot, src)
    if (!isInsideRoot(publicRoot, normalized)) {
      issues.push({ path, message: `路径规范化后越出 public 根目录：${src}` })
      continue
    }

    // 资源键契约：本地键必须是相对键。指向 public 内部的绝对路径同样拒绝——
    // 子路径部署（SITE_BASE）下绝对键会绕过 base 前缀，且结构校验同样禁止绝对键
    if (isAbsolute(src) || src.startsWith('/') || src.startsWith('\\')) {
      issues.push({ path, message: `拒绝绝对路径，本地资源必须是相对资源键：${src}` })
      continue
    }

    // 第二层：目标存在且为文件
    let stat
    try {
      stat = statSync(normalized)
    } catch {
      issues.push({ path, message: `本地图缺失：${src}` })
      continue
    }
    if (!stat.isFile()) {
      issues.push({ path, message: `资源路径指向目录而非文件：${src}` })
      continue
    }

    // 第三层：符号链接的真实目标也不得逃离 public 根
    try {
      const realTarget = realpathSync(normalized)
      if (!isInsideRoot(realRoot, realTarget)) {
        issues.push({ path, message: `符号链接目标越出 public 根目录：${src} -> ${realTarget}` })
      }
    } catch {
      issues.push({ path, message: `本地图缺失：${src}（realpath 解析失败）` })
    }
  }
  return issues
}
