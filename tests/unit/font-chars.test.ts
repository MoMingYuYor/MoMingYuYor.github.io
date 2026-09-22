// 字体字符清单单测：对应 scripts/collect-font-chars.ts 的收集契约（T7）
// 重点：非激活画廊条目与项目展开详情文本必须覆盖；回退符号不得进入子集清单。
import { describe, expect, it } from 'vitest'
import {
  buildCharList,
  buildCharListFileContent,
  collectSiteStrings,
  COMPONENT_FIXED_LABELS,
  FALLBACK_SYMBOLS,
} from '../../scripts/collect-font-chars'
import { site } from '../../src/content/site'

/** 全量收集（内容 + 组件固定标签）后得到的最终字符集 */
function fullCharList(): string[] {
  return buildCharList([...collectSiteStrings(site), ...COMPONENT_FIXED_LABELS])
}

/** 断言文本的每个字符（忽略空白）都在清单里 */
function expectCovered(list: string[], text: string): void {
  const set = new Set(list)
  const missing = [...text].filter((ch) => ch.trim() !== '' && !set.has(ch))
  expect(
    missing,
    `字符清单缺少："${missing.join('')}"（来自文本：${text}）`,
  ).toEqual([])
}

describe('collectSiteStrings', () => {
  it('遍历所有字符串字段，包括非激活条目与详情文本', () => {
    const texts = collectSiteStrings(site)
    // 画廊条目的标题与详情字段都必须被收集（含当前未激活展示的条目）
    expect(texts).toContain('硬件发烧友 · 超频')
    expect(texts).toContain('AI Desk Companion')
    // 展开详情文本：role / period / background / outcome
    expect(texts).toContain('独立开发')
    expect(texts).toContain('完成 Electron 37 + React 19 + TypeScript + sql.js(SQLite) 的桌面端实现：通知分析、多邮箱聚合（只读 IMAP）、桌宠伴侣、确认制工作流与独立于模型的提醒调度引擎；419 个自动化用例通过，提供 Windows 便携版。')
    // about 多段与 contacts
    expect(texts).toContain('第二段用于演示多段排版：关注方向、正在做的事与希望交流的话题都会写在这里。')
    expect(texts).toContain('GitHub')
  })

  it('数字与布尔字段不产生可显示文本，不出现在结果中', () => {
    const texts = collectSiteStrings({ width: 512, allow: false })
    expect(texts).toEqual([])
  })
})

describe('buildCharList', () => {
  it('去重并剔除回退符号', () => {
    const list = buildCharList(['aabb', '◐☀☾☰✕→，。'])
    expect(list.filter((ch) => ch === 'a')).toHaveLength(1)
    for (const sym of FALLBACK_SYMBOLS) {
      expect(list, `回退符号 ${sym} 不应进入清单`).not.toContain(sym)
    }
    expect(list).toContain('，')
    expect(list).toContain('。')
  })

  it('剔除控制字符，保留空格等常规可见字符', () => {
    const list = buildCharList(['a\u0000b', 'SOME PLACES'])
    expect(list).not.toContain('\u0000')
    expect(list).toContain(' ')
    expect(list).toContain('S')
  })
})

describe('完整字符清单覆盖', () => {
  const list = fullCharList()

  it('覆盖 site.ts 全部可显示文本（逐字符校验）', () => {
    for (const text of collectSiteStrings(site)) {
      expectCovered(list, text)
    }
  })

  it('覆盖非激活画廊条目与详情文本', () => {
    // 兴趣第 2 条与作品条目的详情字段，即使不在激活面板也要进字体清单
    expectCovered(list, site.interests[1].title)
    expectCovered(list, site.interests[1].summary)
    expectCovered(list, site.projects[0].title)
    expectCovered(list, site.projects[0].outcome)
  })

  it('覆盖组件固定标签：导航、主题控件、菜单 aria、详情标签与链接', () => {
    expectCovered(list, '首页')
    expectCovered(list, '跳到主要内容')
    expectCovered(list, '跟随系统浅色深色')
    expectCovered(list, '主题偏好：')
    expectCovered(list, '打开导航菜单关闭导航菜单')
    expectCovered(list, '角色时间背景成果访问项目查看源码')
    expectCovered(list, '暮色晴光DARKLIGHT')
  })

  it('覆盖问候语全部分支、星期、日期数字与标点', () => {
    expectCovered(list, '夜深了早上好下午好晚上好')
    expectCovered(list, '周一二三四五六日')
    expectCovered(list, '0123456789/')
    expectCovered(list, '：，。·“”')
  })

  it('回退符号与空清单不混入，结果唯一且有序', () => {
    for (const sym of FALLBACK_SYMBOLS) {
      expect(list).not.toContain(sym)
    }
    const sorted = [...list].sort()
    expect(list).toEqual(sorted)
    expect(new Set(list).size).toBe(list.length)
  })
})

describe('清单文件往返解析（T8，对应 T7 评审杂散 "#" 修复）', () => {
  /**
   * 以 prepare-fonts.py 相同的口径解析清单文件：
   * 过滤空行与 "# " 注释行，其余行逐字拼接为字符负载。
   */
  function parsePayload(fileContent: string): string[] {
    const payload = fileContent
      .split('\n')
      .filter((line) => line !== '' && !line.startsWith('# '))
      .join('')
    return [...payload]
  }

  it('清单文件往返解析 == buildCharList 结果（分隔行不得混入负载）', () => {
    const fileContent = buildCharListFileContent(site)
    expect(parsePayload(fileContent)).toEqual(fullCharList())
  })

  it('站内文本不含 "#" 时，清单不得出现 U+0023（T7 评审：子集曾多含 1 个字形）', () => {
    const texts = collectSiteStrings(site)
    const siteUsesHash = texts.some((text) => text.includes('#'))
    const list = fullCharList()
    if (!siteUsesHash) {
      expect(list).not.toContain('#')
    } else {
      expect(list).toContain('#')
    }
  })
})
