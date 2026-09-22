/**
 * 字体子集字符清单收集（T7）：
 * 静态导入 src/content/site.ts 遍历全部字符串字段（含非激活条目与项目详情文本、
 * contacts、about.paragraphs、hero 文案、galleries 文案、seo 文案、图片 alt），
 * 叠加组件固定标签（导航、主题控件、菜单 aria、面板问候、星期与日期数字、标点等），
 * 去重排序后写入 .generated/font-chars.txt，供 scripts/prepare-fonts.py 消费。
 *
 * 运行方式：npx tsx scripts/collect-font-chars.ts（或 npm run fonts:collect）
 * 输出格式："# " 开头的行为注释；其余行是字符负载（每字符一码位，去重升序）。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { site } from '../src/content/site'
import type { SiteContent } from '../src/types/content'

/**
 * 回退清单：由系统字体/图标呈现的符号，刻意不传入衬线字体子集。
 * 来源：ThemeSwitch.vue 主题符号（◐ ☀ ☾）、Header.vue 菜单图标（☰ ✕）、
 * GallerySection.vue 标签箭头（→）。这些字符必须继续依赖系统字体保底，
 * 一旦进入子集反而会在字体加载前造成更大的回退差异，故在此显式剔除。
 */
export const FALLBACK_SYMBOLS: readonly string[] = ['◐', '☀', '☾', '☰', '✕', '→']

/**
 * 组件固定标签清单：不在 site.ts 中、但会以页面字体渲染的文本。
 * 每组注明来源组件，组件文案变更时须同步维护本清单。
 */
export const COMPONENT_FIXED_LABELS: readonly string[] = [
  // —— App.vue：跳转链接与导航首项 ——
  '跳到主要内容',
  '首页',
  // —— Header.vue：品牌位主题标签（完整/紧凑两档）与菜单 aria 文案 ——
  '暮色 / DARK',
  '晴光 / LIGHT',
  '暮色',
  '晴光',
  '站点导航',
  '打开导航菜单',
  '关闭导航菜单',
  // —— ThemeSwitch.vue：主题选项文案与 aria 前缀 ——
  '跟随系统',
  '浅色',
  '深色',
  '主题偏好：',
  // —— Hero.vue：aria 标签与问候语（datetime.ts greetingFor 全部分支）——
  '社交入口',
  '本地日期与问候',
  '夜深了',
  '早上好',
  '下午好',
  '晚上好',
  // —— GallerySection.vue：tablist aria 后缀"（标题）条目" ——
  '条目',
  // —— ProjectGallery.vue：项目详情事实标签与链接文案（展开详情面板）——
  '角色',
  '时间',
  '背景',
  '成果',
  '访问项目',
  '查看源码',
  // —— AboutSection.vue：联系列表 aria 与音频错误提示 ——
  '联系方式',
  '音频暂时无法播放，请稍后重试。',
  // —— Footer.vue：demo 状态页脚说明与版权符 ——
  '内容与图片为示意',
  '©',
  // —— GallerySection.vue：侧栏引文的 CSS content 引号（::before/::after，不在 DOM 文本里）——
  '“',
  '”',
  // —— datetime.ts：zh-CN 短星期名（周一…周六/周日，locale 由运行环境决定，覆盖全部变体）
  // 与月份长名"十一月/十二月"用字（formatDeviceDate 备用）——
  '周',
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '日',
  '十',
  // —— 日期数字与分隔符：面板大日期"09 / 19"、四位年份、ISO 日期 ——
  '0123456789',
  '/',
  '-',
  // —— 标点兜底（控制器裁定清单）：内容遍历之外显式补充 ——
  '：，。·',
  // —— index.html noscript 提示（system-ui 呈现，纳入以保证完整覆盖）——
  '个人主页',
  '完整主页需要启用 JavaScript 才能浏览。',
]

/** 深度遍历内容对象，收集全部字符串字段（数字/布尔不产生可显示文本，跳过） */
export function collectSiteStrings(root: unknown): string[] {
  const out: string[] = []
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      out.push(value)
      return
    }
    if (Array.isArray(value)) {
      value.forEach(walk)
      return
    }
    if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(walk)
    }
  }
  walk(root)
  return out
}

/**
 * 汇总去重并排序为最终字符集：
 * 剔除回退符号与不可见字符（控制字符），其余内容字符一个不删。
 */
export function buildCharList(texts: readonly string[]): string[] {
  const set = new Set<string>()
  for (const text of texts) {
    for (const ch of text) set.add(ch)
  }
  for (const sym of FALLBACK_SYMBOLS) set.delete(sym)
  return [...set]
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code >= 0x20 && !(code >= 0x7f && code <= 0x9f)
    })
    .sort()
}

/** 生成清单文件完整内容：注释头 + 单行字符负载（T8 修复：分隔行曾用裸 '#'，会被解析为字符负载混入 U+0023） */
export function buildCharListFileContent(content: SiteContent): string {
  const texts = [...collectSiteStrings(content), ...COMPONENT_FIXED_LABELS]
  const chars = buildCharList(texts)
  const lines = [
    '# Noto Serif SC 子集字符清单（T7 生成，勿手改）',
    '# 生成：npx tsx scripts/collect-font-chars.ts；消费：tools/fonts/.venv/Scripts/python.exe scripts/prepare-fonts.py',
    '# 组成：src/content/site.ts 全部字符串字段（含非激活条目与详情文本）+ 组件固定标签（见脚本 COMPONENT_FIXED_LABELS）',
    `# 回退清单（刻意不进衬线子集，由系统字体/图标呈现）：${FALLBACK_SYMBOLS.join(' ')}`,
    '# 格式："# " 开头为注释；其余行为字符负载（去重升序）',
    '# 字符数：' + String(chars.length),
    ...chars,
    '',
  ]
  return lines.join('\n')
}

/** 写入 .generated/font-chars.txt，返回字符数 */
export function writeCharList(content: SiteContent = site): number {
  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.generated/font-chars.txt')
  const file = buildCharListFileContent(content)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, file, 'utf8')
  const payload = file
    .split('\n')
    .filter((line) => line !== '' && !line.startsWith('# '))
    .join('')
  return [...payload].length
}

/** 作为 CLI 直接运行时写清单（被单测导入时无副作用） */
function isDirectRun(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(resolve(entry)).href
}

if (isDirectRun()) {
  const count = writeCharList()
  console.log(`字符清单已写入 .generated/font-chars.txt，共 ${count} 个唯一字符`)
}
