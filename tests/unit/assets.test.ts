// 资源路径纯逻辑单测：对应 src/lib/assets.ts 的 isSafeAssetPath / joinAssetKey 契约
import { describe, expect, it } from 'vitest'
import { isSafeAssetPath, joinAssetKey } from '../../src/lib/assets'

describe('isSafeAssetPath', () => {
  it('接受站点资源键与 https 地址', () => {
    expect(isSafeAssetPath('images/hero-dark.svg')).toBe(true)
    expect(isSafeAssetPath('images/photos/2026/lake.webp')).toBe(true)
    expect(isSafeAssetPath('https://cdn.example.com/a.webp')).toBe(true)
  })

  it('拒绝协议相对地址、其他协议、前导斜杠与目录穿越', () => {
    expect(isSafeAssetPath('//evil.com/a.png')).toBe(false)
    expect(isSafeAssetPath('http://a.com/b.png')).toBe(false)
    expect(isSafeAssetPath('data:text/html,x')).toBe(false)
    expect(isSafeAssetPath('javascript:void(0)')).toBe(false)
    expect(isSafeAssetPath('/images/a.svg')).toBe(false)
    expect(isSafeAssetPath('images/../secret')).toBe(false)
    expect(isSafeAssetPath('')).toBe(false)
  })
})

describe('joinAssetKey', () => {
  it('结合部署 base 生成最终地址，base 规整为带尾斜杠', () => {
    expect(joinAssetKey('/', 'images/a.svg')).toBe('/images/a.svg')
    expect(joinAssetKey('/personal/', 'images/a.svg')).toBe('/personal/images/a.svg')
    expect(joinAssetKey('/personal', 'images/a.svg')).toBe('/personal/images/a.svg')
  })

  it('https 地址原样返回，不安全路径直接抛错', () => {
    expect(joinAssetKey('/', 'https://cdn.example.com/a.webp')).toBe(
      'https://cdn.example.com/a.webp',
    )
    expect(() => joinAssetKey('/', '../a.svg')).toThrow()
    expect(() => joinAssetKey('/', '//evil.com/a.png')).toThrow()
  })

  it('子路径 base 下 https 键仍不拼接前缀（引导脚本与 Hero 共用规则）', () => {
    expect(joinAssetKey('/personal/', 'https://cdn.example.com/a.webp')).toBe(
      'https://cdn.example.com/a.webp',
    )
  })
})
