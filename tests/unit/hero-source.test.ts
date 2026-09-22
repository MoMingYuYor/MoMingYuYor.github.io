// Hero 资源选择纯逻辑单测：对应 src/lib/hero-source.ts 的 selectHeroAsset / buildThemeManifest
import { describe, expect, it } from 'vitest'
import { QUERY_NARROW } from '../../src/composables/useMediaQuery'
import { joinAssetKey } from '../../src/lib/assets'
import {
  buildThemeManifest,
  HERO_NARROW_QUERY,
  selectHeroAsset,
  toManifestEntry,
} from '../../src/lib/hero-source'
import type { ImageAsset } from '../../src/types/content'

function asset(overrides: Partial<ImageAsset>): ImageAsset {
  return { src: 'images/hero-light.webp', alt: '', width: 1600, height: 900, kind: 'photo', ...overrides }
}

const hero = {
  light: asset({ src: 'images/hero-light.webp', mobileSrc: 'images/hero-light-mobile.webp' }),
  dark: asset({ src: 'images/hero-dark.webp' }),
}

describe('HERO_NARROW_QUERY 与 useMediaQuery 断点一致', () => {
  it('引导脚本与 Hero 必须使用同一个窄屏断点', () => {
    expect(HERO_NARROW_QUERY).toBe(QUERY_NARROW)
  })
})

describe('selectHeroAsset', () => {
  it('宽屏选择主图 src', () => {
    expect(selectHeroAsset(hero, 'light', false).key).toBe('images/hero-light.webp')
    expect(selectHeroAsset(hero, 'dark', false).key).toBe('images/hero-dark.webp')
  })

  it('窄屏且有 mobileSrc 时选择 mobileSrc', () => {
    expect(selectHeroAsset(hero, 'light', true).key).toBe('images/hero-light-mobile.webp')
  })

  it('窄屏但缺少 mobileSrc 时回退主图 src', () => {
    expect(selectHeroAsset(hero, 'dark', true).key).toBe('images/hero-dark.webp')
  })

  it('输出完整资源对象，供 picture 渲染两套地址', () => {
    const selected = selectHeroAsset(hero, 'light', true)
    expect(selected.theme).toBe('light')
    expect(selected.asset).toBe(hero.light)
  })

  it('远程 https 地址原样作为选定资源键，不与 base 拼接', () => {
    const remote = { light: asset({ src: 'https://cdn.example.com/hero.webp' }), dark: hero.dark }
    const selected = selectHeroAsset(remote, 'light', false)
    expect(selected.key).toBe('https://cdn.example.com/hero.webp')
    // 与 joinAssetKey 组合后仍不拼前缀
    expect(joinAssetKey('/', selected.key)).toBe('https://cdn.example.com/hero.webp')
  })

  it('远程 https 的 mobileSrc 在窄屏时同样原样选定', () => {
    const remoteMobile = {
      light: asset({ src: 'images/hero-light.webp', mobileSrc: 'https://cdn.example.com/hero-mobile.webp' }),
      dark: hero.dark,
    }
    expect(selectHeroAsset(remoteMobile, 'light', true).key).toBe('https://cdn.example.com/hero-mobile.webp')
  })

  it('manifest 条目（仅 src/mobileSrc）与完整 ImageAsset 走同一选择规则', () => {
    const manifestHero = {
      light: { src: 'images/hero-light.webp', mobileSrc: 'images/hero-light-mobile.webp' },
      dark: { src: 'images/hero-dark.webp' },
    }
    expect(selectHeroAsset(manifestHero, 'light', true).key).toBe(selectHeroAsset(hero, 'light', true).key)
    expect(selectHeroAsset(manifestHero, 'dark', true).key).toBe(selectHeroAsset(hero, 'dark', true).key)
  })
})

describe('toManifestEntry / buildThemeManifest', () => {
  it('仅保留 src、mobileSrc、candidates、sizes，不含 alt 等个人数据', () => {
    const entry = toManifestEntry(
      asset({
        src: 'images/hero-light.webp',
        mobileSrc: 'images/hero-light-mobile.webp',
        candidates: [{ src: 'images/hero-light-800.webp', width: 800 }],
        sizes: '100vw',
      }),
    )
    expect(entry).toEqual({
      src: 'images/hero-light.webp',
      mobileSrc: 'images/hero-light-mobile.webp',
      candidates: [{ src: 'images/hero-light-800.webp', width: 800 }],
      sizes: '100vw',
    })
  })

  it('缺省字段不出现在 manifest 中', () => {
    expect(toManifestEntry(hero.dark)).toEqual({ src: 'images/hero-dark.webp' })
  })

  it('manifest 记录部署 base，本地键经 joinAssetKey 解析出子路径地址', () => {
    const manifest = buildThemeManifest(hero, '/personal/')
    expect(manifest.base).toBe('/personal/')
    expect(joinAssetKey(manifest.base, manifest.hero.light.src)).toBe('/personal/images/hero-light.webp')
    expect(manifest.hero.dark).toEqual({ src: 'images/hero-dark.webp' })
  })
})
