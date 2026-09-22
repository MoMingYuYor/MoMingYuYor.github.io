import { describe, expect, it } from 'vitest'

import {
  absoluteUrl,
  assetPath,
  isSafeAssetPath,
  isSafeSegment,
  normalizeBase,
  sitePath,
} from '../../src/lib/paths'

describe('normalizeBase', () => {
  it('把空值与根路径都收敛为单个斜杠', () => {
    expect(normalizeBase('')).toBe('/')
    expect(normalizeBase('/')).toBe('/')
    expect(normalizeBase('///')).toBe('/')
  })

  it('为子路径补齐首尾斜杠', () => {
    expect(normalizeBase('/personal')).toBe('/personal/')
    expect(normalizeBase('/personal/')).toBe('/personal/')
    expect(normalizeBase('personal')).toBe('/personal/')
    expect(normalizeBase('//personal//')).toBe('/personal/')
  })
})

describe('sitePath', () => {
  it('根路径下生成统一尾斜杠的站内地址', () => {
    expect(sitePath('/')).toBe('/')
    expect(sitePath('/', 'projects')).toBe('/projects/')
    expect(sitePath('/', 'hardware', 'builds')).toBe('/hardware/builds/')
  })

  it('子路径部署时带上 base 前缀', () => {
    expect(sitePath('/personal/', 'blog')).toBe('/personal/blog/')
    expect(sitePath('/personal', 'about')).toBe('/personal/about/')
  })

  it('拒绝不安全的路径段而不是静默丢弃', () => {
    for (const segment of ['', '.', '..', 'a/b', 'a\\b', 'x?y', 'x#y', '\u0000', '\u001f']) {
      expect(() => sitePath('/', segment)).toThrow()
    }
  })
})

describe('isSafeSegment', () => {
  it('接受普通段落与中文段落', () => {
    expect(isSafeSegment('projects')).toBe(true)
    expect(isSafeSegment('ai-desk-companion')).toBe(true)
    expect(isSafeSegment('作品')).toBe(true)
  })

  it('拒绝空段、相对段与带分隔符的段', () => {
    expect(isSafeSegment('')).toBe(false)
    expect(isSafeSegment('.')).toBe(false)
    expect(isSafeSegment('..')).toBe(false)
    expect(isSafeSegment('a/b')).toBe(false)
    expect(isSafeSegment('a\\b')).toBe(false)
  })
})

describe('isSafeAssetPath', () => {
  it('接受站内相对键与带主机的 https 地址', () => {
    expect(isSafeAssetPath('images/hero-light.webp')).toBe(true)
    expect(isSafeAssetPath('images/a/b.webp')).toBe(true)
    expect(isSafeAssetPath('https://cdn.example.com/a.webp')).toBe(true)
  })

  it('拒绝空值、协议相对地址与前导斜杠', () => {
    expect(isSafeAssetPath('')).toBe(false)
    expect(isSafeAssetPath('//evil.example/a.webp')).toBe(false)
    expect(isSafeAssetPath('/images/a.webp')).toBe(false)
  })

  it('拒绝非 https 协议、无主机的 https 与带凭据形式的地址', () => {
    expect(isSafeAssetPath('http://cdn.example.com/a.webp')).toBe(false)
    expect(isSafeAssetPath('javascript:alert(1)')).toBe(false)
    expect(isSafeAssetPath('data:image/svg+xml,<svg/>')).toBe(false)
    expect(isSafeAssetPath('https://')).toBe(false)
    expect(isSafeAssetPath('https://trusted.example@evil.example/a.webp')).toBe(false)
  })

  it('拒绝反斜杠、控制字符与向上穿越', () => {
    expect(isSafeAssetPath('images\\a.webp')).toBe(false)
    expect(isSafeAssetPath('images/\u0000a.webp')).toBe(false)
    expect(isSafeAssetPath('images/../../etc/passwd')).toBe(false)
  })
})

describe('assetPath', () => {
  it('站内相对键拼上 base', () => {
    expect(assetPath('/', 'images/hero.webp')).toBe('/images/hero.webp')
    expect(assetPath('/personal/', 'images/hero.webp')).toBe('/personal/images/hero.webp')
  })

  it('https 绝对地址原样返回', () => {
    expect(assetPath('/personal/', 'https://cdn.example.com/a.webp')).toBe(
      'https://cdn.example.com/a.webp',
    )
  })

  it('不安全的键抛出而不是产出可疑地址', () => {
    expect(() => assetPath('/', '/images/a.webp')).toThrow()
    expect(() => assetPath('/', 'images/../../a.webp')).toThrow()
  })
})

describe('absoluteUrl', () => {
  it('拼出 canonical 用的绝对地址并保持尾斜杠', () => {
    expect(absoluteUrl('https://momingyuyor.github.io', '/')).toBe('https://momingyuyor.github.io/')
    expect(absoluteUrl('https://momingyuyor.github.io/', '/', 'about')).toBe(
      'https://momingyuyor.github.io/about/',
    )
    expect(absoluteUrl('https://momingyuyor.github.io', '/personal/', 'blog')).toBe(
      'https://momingyuyor.github.io/personal/blog/',
    )
  })
})
