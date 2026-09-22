// 主题引导生成链单测：验证 scripts/build-theme-bootstrap.ts 的真实打包产物
// （Vite JS API + configFile:false + write:false + IIFE，manifest 注入虚拟模块）。
// 注意：esbuild 会重排对象字面量（键后加空格），断言只锚定语义内容，不锚定 JSON 格式。
import { describe, expect, it } from 'vitest'
import { getThemeBootstrapScriptTag } from '../../scripts/build-theme-bootstrap'

describe('getThemeBootstrapScriptTag', () => {
  it('生成可内联的 <script>：含 manifest 资源键与 preload 逻辑，且不会提前终止脚本', async () => {
    const tag = await getThemeBootstrapScriptTag('/')
    expect(tag.startsWith('<script>')).toBe(true)
    expect(tag.endsWith('</script>')).toBe(true)
    // 整段标签中 </script 只允许出现一次（结尾闭合标签）
    expect((tag.match(/<\/script/g) ?? []).length).toBe(1)
    expect(tag).not.toContain('<!--')

    // manifest 最小注入：两主题首屏资源键
    expect(tag).toContain('images/hero-light.webp')
    expect(tag).toContain('images/hero-dark.webp')
    // 引导逻辑：同一存储键、主题属性与唯一 preload
    expect(tag).toContain('personal-home:theme')
    expect(tag).toContain('dataset.theme')
    expect(tag).toContain('link.rel = "preload"')
  })

  it('不包含旧手写主题规则与静态 preload', async () => {
    const tag = await getThemeBootstrapScriptTag('/')
    // 旧内联脚本的手写枚举数组不应再出现在生成物中
    expect(tag).not.toContain('VALID.indexOf')
    // 静态 preload（按系统主题两条）已移除：生成物里只有动态创建 preload 的代码
    expect(tag).not.toContain('<link rel="preload"')
  })

  it('base 为子路径时 manifest 原样携带，本地键运行时再拼接', async () => {
    const tag = await getThemeBootstrapScriptTag('/personal/')
    expect(tag).toContain('"/personal/"')
  })
})
