// 构建侧本地媒体资源检查（技术方案 6.3 / T8）：
// 五类输入先于实现编写——缺图、路径指向目录、越界（规范化穿越与符号链接逃逸）、
// 合法资源、HTTPS 远程。测试用 os.tmpdir 临时目录自建 public 根，结束后清理。
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkLocalAssets } from '../../scripts/check-assets'
import type { SiteContent } from '../../src/types/content'

/** 最小合法内容骨架：全部媒体键指向存在的 images/ok.webp，逐用例覆写制造问题 */
function makeContent(overrides: {
  heroDark?: Partial<SiteContent['hero']['dark']>
  avatar?: Partial<NonNullable<SiteContent['identity']['avatar']>>
  interest0?: Partial<SiteContent['interests'][number]['image']>
  project0?: Partial<SiteContent['projects'][number]['image']>
  audio?: SiteContent['audio']
}): SiteContent {
  const baseImage = { alt: '图', width: 1, height: 1, kind: 'photo' as const }
  return {
    status: 'demo',
    identity: {
      displayName: '名',
      headline: '句',
      introduction: '介',
      avatar: { ...baseImage, src: 'images/ok.webp', ...overrides.avatar },
    },
    seo: { title: 't', description: 'd', locale: 'zh-CN', allowIndex: false },
    hero: {
      dark: { ...baseImage, src: 'images/ok.webp', alt: '', ...overrides.heroDark },
      light: { ...baseImage, src: 'images/ok.webp', alt: '' },
    },
    galleries: {
      interests: { heading: '兴趣', intro: '介' },
      projects: { heading: '作品', intro: '介' },
    },
    interests: [
      {
        id: 'i1',
        title: '题',
        summary: '要',
        image: { ...baseImage, src: 'images/ok.webp', ...overrides.interest0 },
      },
    ],
    projects: [
      {
        id: 'p1',
        title: '题',
        summary: '要',
        role: 'r',
        period: 't',
        background: 'b',
        outcome: 'o',
        image: { ...baseImage, src: 'images/ok.webp', ...overrides.project0 },
      },
    ],
    about: { heading: '关于', paragraphs: ['段'], photo: { ...baseImage, src: 'images/ok.webp' } },
    contacts: [{ label: '联', href: 'https://example.com/a' }],
    audio: overrides.audio,
  }
}

describe('checkLocalAssets（临时目录五类输入）', () => {
  let workDir: string
  let publicRoot: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 't8-check-assets-'))
    publicRoot = join(workDir, 'public')
    mkdirSync(join(publicRoot, 'images'), { recursive: true })
    writeFileSync(join(publicRoot, 'images', 'ok.webp'), 'fake-webp-bytes')
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('合法资源与 HTTPS 远程地址均不产生问题，且不对远程发构建期请求', () => {
    mkdirSync(join(publicRoot, 'audio'), { recursive: true })
    writeFileSync(join(publicRoot, 'audio', 'bgm.mp3'), 'fake-audio')
    const content = makeContent({
      audio: { src: 'audio/bgm.mp3', title: '背景音' },
      heroDark: {
        mobileSrc: 'images/ok.webp',
        candidates: [
          { src: 'images/ok.webp', width: 800 },
          { src: 'https://cdn.example.com/hero.avif', width: 1600 },
        ],
      },
    })
    // identity.avatar / hero.dark / hero.light / interests / projects / about.photo / audio 全部合法；
    // https 候选源直接跳过（构建期不发网络请求，链接核验保留人工）
    expect(checkLocalAssets(content, publicRoot)).toEqual([])
  })

  it('缺图：本地图不存在时按字段路径报告', () => {
    const issues = checkLocalAssets(
      makeContent({ heroDark: { src: 'images/missing.webp' } }),
      publicRoot,
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('hero.dark.src')
    expect(issues[0].message).toContain('缺失')
    expect(issues[0].message).toContain('images/missing.webp')
  })

  it('缺图（mobileSrc 与 candidates）：报告到具体字段路径', () => {
    const issues = checkLocalAssets(
      makeContent({
        heroDark: {
          mobileSrc: 'images/missing-mobile.webp',
          candidates: [
            { src: 'images/ok.webp', width: 800 },
            { src: 'images/missing-candidate.webp', width: 1600 },
          ],
        },
      }),
      publicRoot,
    )
    const paths = issues.map((issue) => issue.path)
    expect(paths).toContain('hero.dark.mobileSrc')
    expect(paths).toContain('hero.dark.candidates[1].src')
  })

  it('文件路径指向目录：报告而非当成缺失', () => {
    mkdirSync(join(publicRoot, 'images', 'dir.webp'))
    const issues = checkLocalAssets(
      makeContent({ heroDark: { src: 'images/dir.webp' } }),
      publicRoot,
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('hero.dark.src')
    expect(issues[0].message).toContain('目录')
  })

  it('越界（规范化穿越）：.. 折叠后落在 public 之外即报告', () => {
    // 目标真实存在于根外，证明报告原因是越界而不是缺图
    writeFileSync(join(workDir, 'outside.webp'), 'outside-bytes')
    const issues = checkLocalAssets(
      makeContent({ heroDark: { src: 'images/../../outside.webp' } }),
      publicRoot,
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('hero.dark.src')
    expect(issues[0].message).toContain('越出')
  })

  it('越界（符号链接逃逸）：realpath 后仍须留在 public 内', (ctx) => {
    writeFileSync(join(workDir, 'outside.webp'), 'outside-bytes')
    const linkPath = join(publicRoot, 'images', 'link.webp')
    try {
      symlinkSync(join(workDir, 'outside.webp'), linkPath, 'file')
    } catch {
      // Windows 非管理员等环境可能拒绝创建符号链接：跳过而非误报失败
      return ctx.skip()
    }
    const issues = checkLocalAssets(
      makeContent({ heroDark: { src: 'images/link.webp' } }),
      publicRoot,
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('hero.dark.src')
    expect(issues[0].message).toContain('符号链接')
    expect(issues[0].message).toContain('越出')
  })

  it('绝对路径键一律拒绝：即使指向 public 内部也不符合资源键契约', () => {
    // 指向根外的绝对路径
    const outside = checkLocalAssets(
      makeContent({ heroDark: { src: join(workDir, 'outside.webp') } }),
      publicRoot,
    )
    expect(outside).toHaveLength(1)
    expect(outside[0].message).toContain('越出')
    // 指向根内的绝对路径同样拒绝：资源键必须是相对键，否则子路径部署下绕过 base 前缀
    const inside = checkLocalAssets(
      makeContent({ heroDark: { src: resolve(publicRoot, 'images', 'ok.webp') } }),
      publicRoot,
    )
    expect(inside).toHaveLength(1)
    expect(inside[0].message).toContain('绝对路径')
  })

  it('public 根目录不存在：在 publicRoot 字段报告配置错误', () => {
    const issues = checkLocalAssets(makeContent({}), join(workDir, 'no-such-public'))
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('publicRoot')
  })

  it('多个字段同时有问题：逐字段报告，不互相吞掉', () => {
    const issues = checkLocalAssets(
      makeContent({
        avatar: { src: 'images/missing-avatar.webp' },
        interest0: { src: 'images/missing-interest.webp' },
        project0: { src: 'images/missing-project.webp' },
        audio: { src: 'audio/missing.mp3', title: 't' },
      }),
      publicRoot,
    )
    const paths = issues.map((issue) => issue.path)
    expect(paths).toEqual([
      'identity.avatar.src',
      'interests[0].image.src',
      'projects[0].image.src',
      'audio.src',
    ])
  })
})
