import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  FONT_WEIGHT_GROUPS,
  TEXT_ATTRIBUTES,
  buildCharList,
  buildCharListFileContent,
  extractTextBySelectors,
  isFallbackSymbol,
  isInvisibleCharacter,
  listDistHtmlFiles,
} from '../../scripts/collect-font-chars'

/** prepare-fonts.py 的解析口径：跳过空行与 "# " 开头的注释行，其余每行一个字符 */
function parseCharListFile(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => line !== '' && !line.startsWith('# '))
}

const temporaryDirs: string[] = []

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'font-chars-'))
  temporaryDirs.push(dir)
  return dir
}

afterEach(() => {
  while (temporaryDirs.length > 0) {
    const dir = temporaryDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe('字重分组', () => {
  it('700 覆盖姓名与页头品牌，600 覆盖章节标题与引用', () => {
    const byWeight = new Map(FONT_WEIGHT_GROUPS.map((group) => [group.weight, group.selectors]))
    expect(byWeight.get(700)).toContain('h1')
    expect(byWeight.get(700)).toContain('.display-name')
    expect(byWeight.get(700)).toContain('.site-header__brand')
    expect(byWeight.get(600)).toContain('h2')
    expect(byWeight.get(600)).toContain('blockquote')
  })

  it('只声明 600 与 700 两个档位，与 fonts.css 的 @font-face 对应', () => {
    expect(FONT_WEIGHT_GROUPS.map((group) => group.weight).sort()).toEqual([600, 700])
  })

  it('每个分组都写明了选择器口径，便于日后核对', () => {
    for (const group of FONT_WEIGHT_GROUPS) {
      expect(group.rationale.length).toBeGreaterThan(0)
    }
  })
})

describe('extractTextBySelectors', () => {
  it('抽取命中元素的文本并还原实体', () => {
    const html = '<h1>MoMingYu</h1><p>正文不进衬线子集</p><h2>作品 &amp; 硬件</h2>'
    const texts = extractTextBySelectors(html, ['h1', 'h2'], { attributes: [] })
    expect(texts).toEqual(['MoMingYu', '作品 & 硬件'])
    expect(texts.join('')).not.toContain('正文')
  })

  it('抽取命中元素的 title 与 aria-label', () => {
    const html = '<h2 title="打开导航菜单" aria-label="主题偏好">章节</h2>'
    const texts = extractTextBySelectors(html, ['h2'])
    expect(texts).toContain('章节')
    expect(texts).toContain('打开导航菜单')
    expect(texts).toContain('主题偏好')
    expect(TEXT_ATTRIBUTES).toEqual(['title', 'aria-label'])
  })

  it('收集命中元素内部嵌套标签的文本片段', () => {
    const html = '<h2>章节<span class="n">01</span>标题</h2>'
    // 逐个文本片段返回；字符集合与拼接结果一致，覆盖范围不受影响
    expect(extractTextBySelectors(html, ['h2'], { attributes: [] })).toEqual(['章节', '01', '标题'])
  })

  it('不收集 script 与 style 的内容', () => {
    const html = '<h2>标题</h2><script>var a = "不应收集"</script><style>.a{content:"也不应"}</style>'
    const joined = extractTextBySelectors(html, ['h2'], { attributes: [] }).join('')
    expect(joined).toBe('标题')
  })

  it('不支持的选择器直接报错，不静默少收字符', () => {
    expect(() => extractTextBySelectors('<h2>x</h2>', ['h2 > span'])).toThrow()
    expect(() => extractTextBySelectors('<h2>x</h2>', ['h2.title'])).toThrow()
  })
})

describe('buildCharList', () => {
  it('去重、按码位升序，并保留正常中英文', () => {
    expect(buildCharList(['作品', '作品硬件'])).toEqual(['作', '品', '硬', '件'].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!))
  })

  it('剔除空白、控制字符与不可见格式字符', () => {
    expect(isInvisibleCharacter(' ')).toBe(true)
    expect(isInvisibleCharacter('\n')).toBe(true)
    expect(isInvisibleCharacter('\u200b')).toBe(true)
    expect(isInvisibleCharacter('作')).toBe(false)
    expect(buildCharList(['a b\u200bc'])).toEqual(['a', 'b', 'c'])
  })

  it('剔除刻意由系统字体呈现的符号，但保留普通标点', () => {
    expect(isFallbackSymbol('☰')).toBe(true)
    expect(isFallbackSymbol('→')).toBe(true)
    expect(isFallbackSymbol('作')).toBe(false)
    const chars = buildCharList(['☰ 作品 · 硬件'])
    expect(chars).not.toContain('☰')
    expect(chars).toContain('作')
    expect(chars).toContain('·')
  })

  it('NFC 归一后再去重', () => {
    const decomposed = 'e\u0301'
    const composed = '\u00e9'
    expect(buildCharList([decomposed, composed])).toEqual([composed])
  })
})

describe('buildCharListFileContent', () => {
  const group = FONT_WEIGHT_GROUPS[1]!

  it('注释行以 "# " 开头，负载每行一个字符且无多余字符', () => {
    const chars = ['M', 'o', '作', '品']
    const content = buildCharListFileContent(group, chars, 6)
    expect(parseCharListFile(content)).toEqual(chars)
  })

  it('往返解析不引入杂散字符（历史上 "#" 与换行曾被误收进子集）', () => {
    const chars = ['#', '-', '·', '作']
    const content = buildCharListFileContent(group, chars, 6)
    const parsed = parseCharListFile(content)
    expect(parsed).toEqual(chars)
    // 注释里出现的字符不得进入负载
    expect(parsed).not.toContain('字')
  })

  it('文件头记录字符数与来源文件数，便于核对口径', () => {
    const content = buildCharListFileContent(group, ['a', 'b'], 6)
    expect(content).toContain('# 字符数：2')
    expect(content).toContain('6 个文件')
  })
})

describe('listDistHtmlFiles', () => {
  it('递归收集 HTML 且按路径排序，忽略其他扩展名', () => {
    const root = makeTempDir()
    mkdirSync(join(root, 'about'), { recursive: true })
    mkdirSync(join(root, 'blog'), { recursive: true })
    writeFileSync(join(root, 'index.html'), '<h1>a</h1>')
    writeFileSync(join(root, '404.html'), '<h1>b</h1>')
    writeFileSync(join(root, 'about', 'index.html'), '<h1>c</h1>')
    writeFileSync(join(root, 'blog', 'note.txt'), 'ignore')

    const files = listDistHtmlFiles(root).map((file) => file.slice(root.length + 1))
    // 同层按名称排序：'4' < 'a' < 'i'，因此 404.html 在 about/ 之前
    expect(files).toEqual(['404.html', join('about', 'index.html'), 'index.html'])
  })

  it('目录不存在时返回空数组而不是抛错', () => {
    expect(listDistHtmlFiles(join(tmpdir(), 'font-chars-not-exists'))).toEqual([])
  })
})
