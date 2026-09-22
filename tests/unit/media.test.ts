import { describe, expect, it } from 'vitest'

import {
  HERO_NARROW_QUERY,
  buildThemeManifest,
  imgAttributes,
  objectPositionOf,
  preloadLinkOf,
  selectHeroAsset,
  sizesOf,
  srcsetOf,
  thumbnailSourceOf,
  type HeroAssetPair,
  type MediaAsset,
} from '../../src/lib/media'

const plainAsset: MediaAsset = {
  src: 'images/hero-light.webp',
  alt: '',
  width: 1600,
  height: 900,
  kind: 'photo',
  desktopPosition: '50% 50%',
  mobilePosition: '60% 50%',
}

const responsiveAsset: MediaAsset = {
  src: 'images/shot.webp',
  alt: '应用截图',
  width: 1600,
  height: 1000,
  kind: 'screenshot',
  candidates: [
    { src: 'images/shot-800.webp', width: 800 },
    { src: 'images/shot-400.webp', width: 400 },
    { src: 'images/shot-1600.webp', width: 1600 },
  ],
  sizes: '(max-width: 768px) 100vw, 720px',
}

const heroPair: HeroAssetPair = {
  light: plainAsset,
  dark: { ...plainAsset, src: 'images/hero-dark.webp' },
}

describe('srcsetOf / sizesOf', () => {
  it('没有候选图时不输出 srcset 与 sizes', () => {
    expect(srcsetOf(plainAsset, '/')).toBeUndefined()
    expect(sizesOf(plainAsset)).toBeUndefined()
  })

  it('有候选图时按宽度描述符生成 srcset，并带上 base', () => {
    expect(srcsetOf(responsiveAsset, '/personal/')).toBe(
      '/personal/images/shot-800.webp 800w, /personal/images/shot-400.webp 400w, /personal/images/shot-1600.webp 1600w',
    )
    expect(sizesOf(responsiveAsset)).toBe('(max-width: 768px) 100vw, 720px')
  })
})

describe('objectPositionOf', () => {
  it('窄视口优先 mobilePosition，缺失时退回 desktopPosition', () => {
    expect(objectPositionOf(plainAsset, true)).toBe('60% 50%')
    expect(objectPositionOf(plainAsset, false)).toBe('50% 50%')
    expect(objectPositionOf({ ...plainAsset, mobilePosition: undefined }, true)).toBe('50% 50%')
  })

  it('两者都缺失时返回 undefined，交给 CSS 默认值', () => {
    const noPosition: MediaAsset = { ...plainAsset, desktopPosition: undefined, mobilePosition: undefined }
    expect(objectPositionOf(noPosition, true)).toBeUndefined()
    expect(objectPositionOf(noPosition, false)).toBeUndefined()
  })
})

describe('thumbnailSourceOf', () => {
  it('候选图存在时取最小宽度的那张，不用高分辨率原图当缩略图', () => {
    expect(thumbnailSourceOf(responsiveAsset, '/')).toBe('/images/shot-400.webp')
  })

  it('没有候选图时退回 src', () => {
    expect(thumbnailSourceOf(plainAsset, '/personal/')).toBe('/personal/images/hero-light.webp')
  })
})

describe('imgAttributes', () => {
  it('默认懒加载且不抢首屏优先级', () => {
    const attributes = imgAttributes(plainAsset, '/')
    expect(attributes.src).toBe('/images/hero-light.webp')
    expect(attributes.loading).toBe('lazy')
    expect(attributes.fetchpriority).toBeUndefined()
    expect(attributes.srcset).toBeUndefined()
  })

  it('priority 为真时改为 eager 并声明高优先级', () => {
    const attributes = imgAttributes(plainAsset, '/', { priority: true })
    expect(attributes.loading).toBe('eager')
    expect(attributes.fetchpriority).toBe('high')
  })

  it('保留尺寸与替代文本，装饰图为空 alt', () => {
    const attributes = imgAttributes(plainAsset, '/')
    expect(attributes.width).toBe(1600)
    expect(attributes.height).toBe(900)
    expect(attributes.alt).toBe('')
    expect(imgAttributes(responsiveAsset, '/').alt).toBe('应用截图')
  })
})

describe('preloadLinkOf', () => {
  it('预载与 img 取自同一描述，选到同一个文件', () => {
    const preload = preloadLinkOf(plainAsset, '/personal/')
    const image = imgAttributes(plainAsset, '/personal/')
    expect(preload.href).toBe(image.src)
    expect(preload.rel).toBe('preload')
    expect(preload.as).toBe('image')
    expect(preload.fetchpriority).toBe('high')
  })

  it('有候选图时同时输出 imagesrcset 与 imagesizes', () => {
    const preload = preloadLinkOf(responsiveAsset, '/')
    expect(preload.imagesrcset).toBe(srcsetOf(responsiveAsset, '/'))
    expect(preload.imagesizes).toBe('(max-width: 768px) 100vw, 720px')
  })

  it('没有候选图时不输出空的 imagesrcset', () => {
    const preload = preloadLinkOf(plainAsset, '/')
    expect('imagesrcset' in preload).toBe(false)
    expect('imagesizes' in preload).toBe(false)
  })
})

describe('selectHeroAsset', () => {
  it('按主题选图，窄视口不改变文件', () => {
    expect(selectHeroAsset(heroPair, 'light').src).toBe('images/hero-light.webp')
    expect(selectHeroAsset(heroPair, 'dark').src).toBe('images/hero-dark.webp')
  })
})

describe('HERO_NARROW_QUERY', () => {
  it('保持已核验的 640px 图片裁切断点', () => {
    expect(HERO_NARROW_QUERY).toBe('(max-width: 640px)')
  })
})

describe('buildThemeManifest', () => {
  it('地址在构建期解析完毕，浏览器端不需要路径逻辑', () => {
    const manifest = buildThemeManifest(heroPair, '/personal/')
    expect(manifest.hero.light).toEqual({
      href: '/personal/images/hero-light.webp',
      width: 1600,
      height: 900,
    })
    expect(manifest.hero.dark.href).toBe('/personal/images/hero-dark.webp')
  })

  it('只保留选图与预载必需的字段，不携带站点文案', () => {
    const manifest = buildThemeManifest(heroPair, '/')
    expect(JSON.stringify(manifest)).not.toContain('应用截图')
    expect('alt' in manifest.hero.light).toBe(false)
    expect('base' in manifest).toBe(false)
  })
})
