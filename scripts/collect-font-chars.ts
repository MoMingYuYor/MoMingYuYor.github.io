/**
 * 字体子集字符清单收集（S1-T4）。
 *
 * 字符来源是**构建产物**（`dist` 下的全部 HTML），不是源码或内容文件：只有真正渲染进 HTML
 * 的文本才会出现在页面上。按**字重分别收集**（规格第 9 节「按真正使用的文本与字重构建」）：
 *
 *   - 700：`h1`（姓名与主要标题，首页姓名为 `h1.display-name`）与 `.site-header__brand`
 *     （页头品牌，`SiteHeader.astro` 声明为衬线 + `--font-weight-bold`）。
 *   - 600：`h2`、`h3`、`blockquote`，以及 `h1`——`src/styles/global.css` 把 `h1`–`h6`
 *     的 `font-weight` 统一为 `--font-weight-semibold`（600），同一批 `h1` 字符必须同时
 *     进 600，否则非首页的 `h1`（作品/文章/硬件/关于/404）会掉到系统衬线字体，与同页
 *     600 字重的章节标题不一致。`.section-header__title` 是 `h2`，已由 `h2` 覆盖。
 *
 * 不进子集的内容：正文段落、列表、URL、`alt`、等宽与无衬线元素——它们由系统无衬线承担，
 * 混进衬线子集只会白增体积。
 *
 * 元素文本之外，还收集命中元素**自身**的 `title` 与 `aria-label` 属性值（工具提示与读屏
 * 文本会用到）；只取命中元素的属性，不把整页属性文本并进衬线子集。
 *
 * 输出：`src/assets/fonts/chars-600.txt`、`chars-700.txt`（格式见文件头注释），
 * 供 `scripts/prepare-fonts.py` 消费。相同输入重复运行产出相同字节。
 *
 * 运行：`npm run fonts:collect`（或 `npx tsx scripts/collect-font-chars.ts`）。
 * 本脚本只在本机维护字体子集时运行，`npm run build` 不调用它。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const DIST_DIR = resolve(PROJECT_ROOT, 'dist')
/** 字符清单与子集产物放在一起并入库：它是「子集覆盖了哪些字」的契约，CI 覆盖校验要读它 */
export const CHAR_LIST_DIR = resolve(PROJECT_ROOT, 'src/assets/fonts')

/**
 * 回退清单：刻意由系统字体呈现的符号，绝不进入衬线子集。
 *
 * 这些符号在站内承担图形语义（主题三态、菜单开合、方向指示），本来就靠系统字体保底；
 * 一旦进了子集，字体加载前后反而会出现更大的回退差异。除本清单外，`isFallbackSymbol`
 * 还按区间排除箭头、杂项符号、emoji 与不可见格式字符。
 */
export const FALLBACK_SYMBOLS: readonly string[] = [
  // 主题三态符号（ThemeControl）
  '◐',
  '☀',
  '☾',
  // 菜单开合符号（NavMenu）
  '☰',
  '✕',
  // 方向与指示箭头
  '→',
  '←',
  '↑',
  '↓',
]

/** 命中元素上会渲染成文字的属性：工具提示与读屏文本 */
export const TEXT_ATTRIBUTES: readonly string[] = ['title', 'aria-label']

export interface FontWeightGroup {
  /** 与 `src/styles/fonts.css` 的 `@font-face` 字重一一对应 */
  readonly weight: 600 | 700
  /** 命中这些选择器的元素，其文本进入本字重子集 */
  readonly selectors: readonly string[]
  /** 为什么是这些选择器（写入清单文件头，便于日后核对） */
  readonly rationale: string
}

/**
 * 字重分组。选择器只支持标签名与 `.类名` 两种形式，不支持组合与层级选择器——
 * 见 `assertSupportedSelector`，不支持的形式会直接报错而不是静默少收字符。
 */
export const FONT_WEIGHT_GROUPS: readonly FontWeightGroup[] = [
  {
    weight: 700,
    selectors: ['h1', '.display-name', '.site-header__brand'],
    rationale:
      'h1 姓名与主要标题（首页 h1.display-name）、页头品牌 .site-header__brand（衬线 700）',
  },
  {
    weight: 600,
    selectors: ['h1', 'h2', 'h3', 'blockquote'],
    rationale:
      '章节标题与引用（h2、h3、blockquote；.section-header__title 即 h2）；h1 因全局规则字重为 600 同时进本档',
  },
]

/** 空白、控制字符与不可见格式字符：不承载字形，剔除 */
const FORMAT_CHARACTER = /[\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/
/** emoji 与符号区间：刻意由系统字体呈现 */
const FALLBACK_RANGES = /[\u2190-\u21ff\u2600-\u27bf\u2b00-\u2bff\ufe0e\ufe0f\u20e3\u200d]|[\u{1f000}-\u{1faff}]/u

/** 原始文本元素：内容不是 HTML，整体跳过，避免其中的 `<` 破坏分词 */
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title'])
/** 空元素：没有文本子节点 */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  middot: '·',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  copy: '©',
  times: '×',
}

interface OpenTag {
  readonly name: string
  readonly attrs: ReadonlyMap<string, string>
  readonly classes: ReadonlySet<string>
  readonly selfClosing: boolean
}

type Token =
  | { readonly type: 'open'; readonly tag: OpenTag }
  | { readonly type: 'close'; readonly name: string }
  | { readonly type: 'text'; readonly value: string }

/** 解码 HTML 实体（Astro 会把 `&`、`<`、引号等转义后写进产物） */
function decodeEntities(text: string): string {
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match
      try {
        return String.fromCodePoint(code)
      } catch {
        return match
      }
    }
    return NAMED_ENTITIES[body] ?? match
  })
}

/** 解析开始标签的属性；属性值里的 `>` 在产物中已被转义为 `&gt;`，故可按 `>` 截断 */
function parseAttributes(source: string): Map<string, string> {
  const attrs = new Map<string, string>()
  const pattern = /([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    const name = match[1]
    if (!name) continue
    attrs.set(name.toLowerCase(), decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''))
  }
  return attrs
}

/** 把 HTML 拆成开始标签、结束标签与文本三类标记；注释、声明与原始文本元素整体丢弃 */
function tokenize(html: string): Token[] {
  const tokens: Token[] = []
  let cursor = 0
  while (cursor < html.length) {
    const lt = html.indexOf('<', cursor)
    if (lt === -1) {
      tokens.push({ type: 'text', value: html.slice(cursor) })
      break
    }
    if (lt > cursor) tokens.push({ type: 'text', value: html.slice(cursor, lt) })

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      cursor = end === -1 ? html.length : end + 3
      continue
    }
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      const end = html.indexOf('>', lt)
      cursor = end === -1 ? html.length : end + 1
      continue
    }

    const gt = html.indexOf('>', lt)
    if (gt === -1) {
      // 未闭合的 `<`：当普通文本处理，避免整段丢失
      tokens.push({ type: 'text', value: html.slice(lt) })
      break
    }
    const inner = html.slice(lt + 1, gt)
    cursor = gt + 1

    if (inner.startsWith('/')) {
      tokens.push({ type: 'close', name: inner.slice(1).trim().toLowerCase() })
      continue
    }

    const selfClosing = inner.endsWith('/')
    const body = selfClosing ? inner.slice(0, -1) : inner
    const nameMatch = /^[a-zA-Z][^\s/>]*/.exec(body)
    const name = (nameMatch?.[0] ?? '').toLowerCase()
    if (name === '') continue

    if (RAW_TEXT_ELEMENTS.has(name)) {
      // 整体跳过原始文本元素：其内容不是 HTML（内联脚本里可能有 `<`），且从不承载衬线文本
      const closePattern = new RegExp(`</${name}\\s*>`, 'i')
      const rest = html.slice(cursor)
      const closeMatch = closePattern.exec(rest)
      cursor = closeMatch ? cursor + closeMatch.index + closeMatch[0].length : html.length
      continue
    }

    const attrs = parseAttributes(body.slice(nameMatch?.[0].length ?? 0))
    const classValue = attrs.get('class') ?? ''
    tokens.push({
      type: 'open',
      tag: {
        name,
        attrs,
        classes: new Set(classValue.split(/\s+/).filter(Boolean)),
        selfClosing,
      },
    })
  }
  return tokens
}

/** 只接受标签名与 `.类名`：其余形式直接报错，不静默少收字符 */
function assertSupportedSelector(selector: string): void {
  if (/^\.[A-Za-z_][\w-]*$/.test(selector) || /^[a-zA-Z][\w-]*$/.test(selector)) return
  throw new Error(
    `不支持的字体选择器语法："${selector}"。只支持标签名（如 h2）与 .类名（如 .display-name）两种形式。`,
  )
}

function matchesSelector(selector: string, tag: OpenTag): boolean {
  if (selector.startsWith('.')) return tag.classes.has(selector.slice(1))
  return tag.name === selector.toLowerCase()
}

/**
 * 抽出命中选择器的元素文本与 `title`/`aria-label` 属性值。
 * 命中元素的**后代**文本一并计入（如 `<h2><span>标题</span></h2>`）。
 */
export function extractTextBySelectors(
  html: string,
  selectors: readonly string[],
  options: { readonly attributes?: readonly string[] } = {},
): string[] {
  for (const selector of selectors) assertSupportedSelector(selector)
  const attributes = options.attributes ?? TEXT_ATTRIBUTES
  const texts: string[] = []
  const stack: Array<{ readonly name: string; readonly matched: boolean }> = []
  let matchedDepth = 0

  for (const token of tokenize(html)) {
    if (token.type === 'open') {
      const matched = selectors.some((selector) => matchesSelector(selector, token.tag))
      if (matched) {
        for (const attribute of attributes) {
          const value = token.tag.attrs.get(attribute)
          if (value) texts.push(value)
        }
      }
      if (!token.tag.selfClosing && !VOID_ELEMENTS.has(token.tag.name)) {
        stack.push({ name: token.tag.name, matched })
        if (matched) matchedDepth += 1
      }
      continue
    }

    if (token.type === 'close') {
      let found = -1
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index].name === token.name) {
          found = index
          break
        }
      }
      if (found === -1) continue
      for (let index = stack.length - 1; index >= found; index -= 1) {
        if (stack[index].matched) matchedDepth -= 1
      }
      stack.length = found
      continue
    }

    if (matchedDepth > 0) texts.push(decodeEntities(token.value))
  }

  return texts
}

/** 刻意由系统字体呈现的符号：显式清单 + 箭头/符号/emoji/格式字符区间 */
export function isFallbackSymbol(ch: string, fallback: readonly string[] = FALLBACK_SYMBOLS): boolean {
  return fallback.includes(ch) || FALLBACK_RANGES.test(ch)
}

/** 空白、控制字符与不可见格式字符：不产生字形，剔除 */
export function isInvisibleCharacter(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0
  if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true
  if (/\s/u.test(ch)) return true
  return FORMAT_CHARACTER.test(ch)
}

/**
 * 归一化并去重为最终字符清单：NFC 归一、去重、剔除空白/控制/格式字符与回退符号，
 * 其余字符一个不删（正常中文不会被悄悄剔除），按码位升序。
 */
export function buildCharList(
  values: readonly string[],
  fallback: readonly string[] = FALLBACK_SYMBOLS,
): string[] {
  const chars = new Set<string>()
  for (const value of values) {
    for (const ch of value.normalize('NFC')) {
      if (isInvisibleCharacter(ch)) continue
      if (isFallbackSymbol(ch, fallback)) continue
      chars.add(ch)
    }
  }
  return [...chars].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
}

/** 生成清单文件内容：`# ` 开头的注释行 + 每行一个字符的负载（与 prepare-fonts.py 的解析口径一致） */
export function buildCharListFileContent(
  group: FontWeightGroup,
  chars: readonly string[],
  htmlFileCount: number,
): string {
  const header = [
    `# Noto Serif SC ${group.weight} 字重子集字符清单（S1-T4 生成，勿手改）`,
    '# 生成：npm run fonts:collect（scripts/collect-font-chars.ts）；消费：npm run fonts:subset',
    `# 字符来源：dist/**/*.html（${htmlFileCount} 个文件）中命中选择器的元素文本与 ${TEXT_ATTRIBUTES.join('、')} 属性值`,
    `# 选择器：${group.selectors.join('、')}`,
    `# 口径：${group.rationale}`,
    `# 回退清单（刻意不进衬线子集，由系统字体呈现）：${FALLBACK_SYMBOLS.join(' ')}`,
    '# 回退区间：箭头 U+2190–U+21FF、杂项符号 U+2600–U+27BF、补充符号 U+2B00–U+2BFF、emoji U+1F000–U+1FAFF、不可见格式字符',
    '# 剔除：空白、控制字符与不可见格式字符（不承载字形）',
    '# 格式："# " 开头为注释行；其余每行一个字符（NFC 归一、去重、码位升序）',
    `# 字符数：${chars.length}`,
  ]
  return [...header, ...chars, ''].join('\n')
}

/** 列出 dist 下全部 HTML 产物（按路径排序，保证输出可重复） */
export function listDistHtmlFiles(dir: string = DIST_DIR): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  const walk = (current: string): void => {
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full)
    }
  }
  walk(dir)
  return files
}

export interface CharListResult {
  readonly weight: number
  readonly charCount: number
  readonly filePath: string
  readonly htmlFileCount: number
}

/** 按字重收集并写入清单文件，返回各档字符数 */
export function writeCharLists(): CharListResult[] {
  const htmlFiles = listDistHtmlFiles()
  if (htmlFiles.length === 0) {
    console.error(
      `错误：未找到构建产物 HTML（${relative(PROJECT_ROOT, DIST_DIR)} 下无 .html 文件）。\n` +
        '字符清单以构建产物为准，请先运行 npm run build，再运行 npm run fonts:collect。',
    )
    process.exit(1)
  }

  const documents = htmlFiles.map((file) => readFileSync(file, 'utf8'))
  mkdirSync(CHAR_LIST_DIR, { recursive: true })

  return FONT_WEIGHT_GROUPS.map((group) => {
    const texts = documents.flatMap((html) =>
      extractTextBySelectors(html, group.selectors, { attributes: TEXT_ATTRIBUTES }),
    )
    const chars = buildCharList(texts)
    if (chars.length === 0) {
      console.error(
        `错误：字重 ${group.weight} 收集到的字符为 0，选择器与站点结构可能已不匹配：${group.selectors.join('、')}`,
      )
      process.exit(1)
    }
    const filePath = join(CHAR_LIST_DIR, `chars-${group.weight}.txt`)
    writeFileSync(filePath, buildCharListFileContent(group, chars, htmlFiles.length), 'utf8')
    return { weight: group.weight, charCount: chars.length, filePath, htmlFileCount: htmlFiles.length }
  })
}

/** 作为 CLI 直接运行时写清单；被单测导入时无副作用 */
function isDirectRun(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(resolve(entry)).href
}

if (isDirectRun()) {
  for (const result of writeCharLists()) {
    console.log(
      `字重 ${result.weight}：${result.charCount} 个唯一字符 → ${relative(PROJECT_ROOT, result.filePath)}` +
        `（扫描 ${result.htmlFileCount} 个 HTML 产物）`,
    )
  }
}
