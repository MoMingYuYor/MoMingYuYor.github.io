/**
 * 字体覆盖守卫：构建产物里真正用衬线的文字，必须都在已入库子集的字符清单里。
 *
 * 为什么需要它：字符清单是按**构建产物**收集的，子集也只在本地重建。内容一变
 * （新增标题、改文案、加页面），子集就可能缺字，而缺字在浏览器里表现为静默回退到
 * 系统衬线字体——构建不会失败，测试也不会失败，只有肉眼才看得出来。
 * 这条检查把那种情形变成一次可定位的构建失败。
 *
 * 只读字符清单、不解析 woff2：清单与子集产物一起入库，是两者之间的契约，
 * 因此本检查不需要 Python 环境，可以在 CI 上跑。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CHAR_LIST_DIR,
  FONT_WEIGHT_GROUPS,
  TEXT_ATTRIBUTES,
  buildCharList,
  extractTextBySelectors,
  listDistHtmlFiles,
} from './collect-font-chars'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const DIST_DIR = resolve(ROOT, 'dist')

/** 按 prepare-fonts.py 的解析口径读取清单：跳过空行与 "# " 开头的注释行 */
export function parseCharList(content: string): Set<string> {
  const chars = new Set<string>()
  for (const line of content.split('\n')) {
    if (line === '' || line.startsWith('# ')) continue
    chars.add(line)
  }
  return chars
}

interface CoverageGap {
  readonly weight: number
  readonly missing: string[]
  readonly listPath: string
}

export function checkFontCoverage(): CoverageGap[] {
  const htmlFiles = listDistHtmlFiles(DIST_DIR)
  if (htmlFiles.length === 0) {
    throw new Error('未找到构建产物 HTML：请先运行 npm run build，字体覆盖以产物用字为准')
  }
  const documents = htmlFiles.map((file) => readFileSync(file, 'utf8'))

  const gaps: CoverageGap[] = []
  for (const group of FONT_WEIGHT_GROUPS) {
    const listPath = join(CHAR_LIST_DIR, `chars-${group.weight}.txt`)
    if (!existsSync(listPath)) {
      throw new Error(`缺少字重 ${group.weight} 的字符清单：${relative(ROOT, listPath)}`)
    }
    const covered = parseCharList(readFileSync(listPath, 'utf8'))
    const used = buildCharList(
      documents.flatMap((html) =>
        extractTextBySelectors(html, group.selectors, { attributes: TEXT_ATTRIBUTES }),
      ),
    )
    const missing = used.filter((char) => !covered.has(char))
    if (missing.length > 0) gaps.push({ weight: group.weight, missing, listPath })
  }
  return gaps
}

function describe(char: string): string {
  return `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}(${char})`
}

function main(): void {
  const gaps = checkFontCoverage()
  if (gaps.length === 0) {
    console.log('字体覆盖检查通过：产物中用衬线的文字都被已入库子集覆盖。')
    return
  }
  for (const gap of gaps) {
    console.error(
      `字重 ${gap.weight} 有 ${gap.missing.length} 个字符不在子集清单里：` +
        gap.missing.map(describe).join(' '),
    )
    console.error(`  清单：${relative(ROOT, gap.listPath)}`)
  }
  console.error(
    '\n这些字会静默回退到系统衬线字体。请重建子集后提交新的清单与 woff2：\n' +
      '  npm run build && npm run fonts:build\n' +
      '（需要 assets/fonts-source/ 字体源与 tools/fonts/.venv/ 环境，见 README）',
  )
  process.exit(1)
}

const entry = process.argv[1]
if (entry && resolve(entry) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
