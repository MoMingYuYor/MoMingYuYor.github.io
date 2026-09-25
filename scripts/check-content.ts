/**
 * 内容校验闸门（S2-T4）。
 *
 * 串行执行：读取内容目录 → Schema 解析 → 跨条目校验 → 本地素材真实路径检查。
 * 任一 blocking 问题即打印全部问题并以非零码退出，阻断构建。
 *
 * 本地素材检查用 `realpath`：符号链接指向 `public/` 之外时视为越界，
 * 与旧实现的 check-assets 同思路——只比较字符串前缀挡不住符号链接。
 *
 * 用法：`npm run check:content`；正式发布模式用 `npm run check:content -- --release`。
 */
import { existsSync, realpathSync, statSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadSnapshot } from '../src/content/load-snapshot'
import { hasBlockingIssue, validateCollections, type ContentIssue } from '../src/content/validate'
import { isSafeAssetPath } from '../src/lib/paths'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_ROOT = resolve(ROOT, 'public')

/** 解析站内资源键到 public/ 下的真实文件；越界与符号链接逃逸都报 unsafe */
export function resolveLocalFile(key: string): 'file' | 'missing' | 'unsafe' {
  if (!isSafeAssetPath(key)) return 'unsafe'
  if (/^https:\/\//i.test(key)) return 'file'

  const target = resolve(PUBLIC_ROOT, key)
  const relativeToPublic = relative(PUBLIC_ROOT, target)
  if (relativeToPublic.startsWith('..') || isAbsolute(relativeToPublic)) return 'unsafe'
  if (!existsSync(target)) return 'missing'

  let realTarget: string
  let realPublic: string
  try {
    realTarget = realpathSync(target)
    realPublic = realpathSync(PUBLIC_ROOT)
  } catch {
    return 'missing'
  }
  const realRelative = relative(realPublic, realTarget)
  if (realRelative.startsWith('..') || isAbsolute(realRelative)) return 'unsafe'
  if (realTarget.includes(`${sep}..${sep}`)) return 'unsafe'

  try {
    return statSync(realTarget).isFile() ? 'file' : 'missing'
  } catch {
    return 'missing'
  }
}

function formatIssue(issue: ContentIssue): string {
  const tag = issue.severity === 'blocking' ? '错误' : '警告'
  return `  [${tag}] ${issue.path}：${issue.message}`
}

function main(): void {
  const mode = process.argv.includes('--release') ? 'release' : 'preview'
  const { snapshot, issues: loadIssues } = loadSnapshot()

  const schemaIssues: ContentIssue[] = loadIssues.map((issue) => ({
    path: issue.path,
    message: issue.message,
    severity: 'blocking',
  }))

  const semanticIssues = validateCollections(snapshot, {
    now: new Date(),
    mode,
    resolveLocalFile,
  })

  const all = [...schemaIssues, ...semanticIssues]
  const counts = {
    projects: snapshot.projects.length,
    posts: snapshot.posts.length,
    builds: snapshot.builds.length,
    overclocking: snapshot.overclocking.length,
  }

  console.log(
    `内容校验（模式 ${mode}）：projects ${counts.projects} / posts ${counts.posts} / ` +
      `builds ${counts.builds} / overclocking ${counts.overclocking}`,
  )

  if (all.length === 0) {
    console.log('未发现问题。')
    return
  }

  console.error(`\n发现 ${all.length} 个问题：`)
  for (const issue of all) console.error(formatIssue(issue))

  if (hasBlockingIssue(all)) {
    console.error('\n存在阻断级问题，构建终止。')
    process.exit(1)
  }
  console.log('\n只有警告，按当前模式不阻断。')
}

main()
