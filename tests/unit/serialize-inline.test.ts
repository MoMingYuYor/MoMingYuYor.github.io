// 内联脚本注入数据的最小安全序列化：对应 src/lib/serialize-inline.ts
import { describe, expect, it } from 'vitest'
import { serializeInline } from '../../src/lib/serialize-inline'

describe('serializeInline', () => {
  it('转义 </script> 序列，防止脚本标签提前结束', () => {
    const out = serializeInline({ s: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c/script\\u003e')
  })

  it('转义 <、>、& 与 U+2028、U+2029，且 JSON 层面可无损还原', () => {
    const value = { a: '</script>&<b>', b: '行\u2028分\u2029隔' }
    const out = serializeInline(value)
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
    expect(out).not.toContain('&')
    expect(out).not.toContain('\u2028')
    expect(out).not.toContain('\u2029')
    // \u003c 等本身就是合法 JSON 转义，可直接解析回原值
    expect(JSON.parse(out)).toEqual(value)
  })

  it('作为 JS 表达式求值时语义等价（模拟内联脚本场景）', () => {
    const value = { base: '/', hero: { light: { src: 'a</script>b&c' } } }
    // eslint 下等价于内联脚本执行注入数据：转义后的 JSON 是合法 JS 字面量
    const restored = new Function(`return ${serializeInline(value)}`)() as typeof value
    expect(restored).toEqual(value)
  })

  it('纯对象输入保持键序与结构', () => {
    const value = { base: '/personal/', hero: { light: { src: 'images/a.webp' }, dark: { src: 'images/b.webp' } } }
    expect(serializeInline(value)).toBe(
      '{"base":"/personal/","hero":{"light":{"src":"images/a.webp"},"dark":{"src":"images/b.webp"}}}',
    )
  })
})
